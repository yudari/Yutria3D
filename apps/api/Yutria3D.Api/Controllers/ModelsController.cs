using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Yutria3D.Api.Data;
using Yutria3D.Api.Helpers;
using Yutria3D.Api.Models;
using Yutria3D.Api.Options;
using Yutria3D.Api.Services;

namespace Yutria3D.Api.Controllers;

public sealed record ModelDto(Guid Id, string Name, long SizeBytes, DateTime CreatedAt, string Status, int Progress);
public sealed record ModelDetailDto(Guid Id, string Name, long SizeBytes, DateTime CreatedAt, string Status, int Progress, string Urn);
public sealed record StatusDto(string Status, int Progress, string? FailureMessage);
public sealed class UploadRequest
{
    public IFormFile? File { get; set; }
    public string? Name { get; set; }
}

[ApiController]
[Route("api/models")]
[Authorize]
public sealed class ModelsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IApsClient _aps;
    private readonly ApsOptions _apsOptions;

    public ModelsController(AppDbContext db, IApsClient aps, IOptions<ApsOptions> apsOptions)
    {
        _db = db;
        _aps = aps;
        _apsOptions = apsOptions.Value;
    }

    [HttpPost]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<ModelDetailDto>> Upload(
        [FromForm] UploadRequest request,
        CancellationToken ct)
    {
        var file = request.File;
        var name = request.Name;
        var userId = CurrentUserId();
        if (userId is null)
            return Unauthorized();

        var limitBytes = (long)Math.Max(1, _apsOptions.MaxUploadMb) * 1024 * 1024;
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "File is required." });
        if (!string.Equals(Path.GetExtension(file.FileName), ".rvt", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "Only .rvt files are accepted." });
        if (file.Length > limitBytes)
            return StatusCode(StatusCodes.Status413PayloadTooLarge,
                new { error = $"File exceeds the upload limit of {_apsOptions.MaxUploadMb} MB." });

        var model = new Model
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Name = string.IsNullOrWhiteSpace(name)
                ? Path.GetFileNameWithoutExtension(file.FileName)
                : name.Trim(),
            BucketKey = _apsOptions.Bucket,
            ObjectKey = $"{Guid.NewGuid():N}.rvt",
            Status = "pending",
            Progress = 0,
            SizeBytes = file.Length,
            CreatedAt = DateTime.UtcNow,
        };
        _db.Models.Add(model);
        await _db.SaveChangesAsync(ct);

        try
        {
            await IngestAsync(model, file.OpenReadStream(), file.FileName, ct);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            model.Status = "failed";
            model.FailureMessage = ex.Message;
            await _db.SaveChangesAsync(ct);
            return StatusCode(StatusCodes.Status502BadGateway,
                new { error = "APS upload/translation failed.", detail = ex.Message });
        }

        return CreatedAtAction(nameof(GetById), new { id = model.Id }, ToDetail(model));
    }

    /// <summary>Salin file contoh dari server ke akun pengguna lalu antrekan penerjemahan.</summary>
    [HttpPost("sample")]
    public async Task<ActionResult<ModelDetailDto>> UploadSample(CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null)
            return Unauthorized();
        const string namaContoh = "bistro-restaurant-booth-modular-seating.rvt";
        var kandidat = new[]
        {
            Environment.GetEnvironmentVariable("SAMPLE_DIR"),
            Path.Combine(AppContext.BaseDirectory, "SampleFiles"),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "SampleFiles"),
        };
        string? contohPath = null;
        foreach (var dir in kandidat)
        {
            if (string.IsNullOrWhiteSpace(dir)) continue;
            var p = Path.GetFullPath(Path.Combine(dir, namaContoh));
            if (System.IO.File.Exists(p)) { contohPath = p; break; }
        }
        if (contohPath is null)
            return NotFound(new { error = "File contoh tidak tersedia di server." });
        var info = new FileInfo(contohPath);
        var model = new Model
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Name = Path.GetFileNameWithoutExtension(info.Name),
            BucketKey = _apsOptions.Bucket,
            ObjectKey = $"{Guid.NewGuid():N}.rvt",
            Status = "pending",
            Progress = 0,
            SizeBytes = info.Length,
            CreatedAt = DateTime.UtcNow,
        };
        _db.Models.Add(model);
        await _db.SaveChangesAsync(ct);
        try
        {
            await using var stream = System.IO.File.OpenRead(contohPath);
            await IngestAsync(model, stream, info.Name, ct);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            model.Status = "failed";
            model.FailureMessage = ex.Message;
            await _db.SaveChangesAsync(ct);
            return StatusCode(StatusCodes.Status502BadGateway,
                new { error = "APS upload/translation failed.", detail = ex.Message });
        }
        return CreatedAtAction(nameof(GetById), new { id = model.Id }, ToDetail(model));
    }

    private async Task IngestAsync(Model model, Stream content, string fileName, CancellationToken ct)
    {
        await _aps.EnsureBucketAsync(model.BucketKey, ct);
        var objectId = await _aps.SignedS3UploadAsync(content, model.BucketKey, model.ObjectKey, ct);
        model.Urn = Urn.ToBase64UrlNoPadding(objectId);
        await _aps.StartTranslationAsync(objectId, ct);
        model.Status = "inprogress";
        await _db.SaveChangesAsync(ct);
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ModelDto>>> List(CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null)
            return Unauthorized();

        var models = await _db.Models
            .Where(m => m.UserId == userId)
            .OrderByDescending(m => m.CreatedAt)
            .Select(m => new ModelDto(m.Id, m.Name, m.SizeBytes, m.CreatedAt, m.Status, m.Progress))
            .ToListAsync(ct);
        return Ok(models);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ModelDetailDto>> GetById(Guid id, CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null)
            return Unauthorized();

        var model = await _db.Models.FirstOrDefaultAsync(m => m.Id == id && m.UserId == userId, ct);
        if (model is null)
            return NotFound();

        return Ok(ToDetail(model));
    }

    [HttpGet("{id:guid}/status")]
    public async Task<ActionResult<StatusDto>> GetStatus(Guid id, CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null)
            return Unauthorized();

        var model = await _db.Models.FirstOrDefaultAsync(m => m.Id == id && m.UserId == userId, ct);
        if (model is null)
            return NotFound();

        if (model.Status is "success" or "failed" or "timeout" || string.IsNullOrEmpty(model.Urn))
            return Ok(new StatusDto(model.Status, model.Progress, model.FailureMessage));

        string? manifest;
        try
        {
            manifest = await _aps.GetManifestAsync(model.Urn, ct);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            return StatusCode(StatusCodes.Status502BadGateway,
                new { error = "APS manifest request failed.", detail = ex.Message });
        }

        if (manifest is null)
            return Ok(new StatusDto(model.Status, model.Progress, model.FailureMessage));

        var dto = MapManifest(manifest, model);
        model.Status = dto.Status;
        model.Progress = dto.Progress;
        model.FailureMessage = dto.FailureMessage;
        await _db.SaveChangesAsync(ct);
        return Ok(dto);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null)
            return Unauthorized();

        var model = await _db.Models.FirstOrDefaultAsync(m => m.Id == id && m.UserId == userId, ct);
        if (model is null)
            return NotFound();

        try
        {
            if (!string.IsNullOrEmpty(model.Urn))
                await _aps.DeleteManifestAsync(model.Urn, ct);
            await _aps.DeleteObjectAsync(model.BucketKey, model.ObjectKey, ct);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            return StatusCode(StatusCodes.Status502BadGateway,
                new { error = "APS delete failed.", detail = ex.Message });
        }

        _db.Models.Remove(model);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private string? CurrentUserId()
        => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");

    private static ModelDetailDto ToDetail(Model m)
        => new(m.Id, m.Name, m.SizeBytes, m.CreatedAt, m.Status, m.Progress, m.Urn);

    private static StatusDto MapManifest(string manifestJson, Model current)
    {
        try
        {
            using var doc = JsonDocument.Parse(manifestJson);
            var root = doc.RootElement;

            var status = root.TryGetProperty("status", out var statusEl)
                ? statusEl.GetString()
                : current.Status;
            if (string.IsNullOrWhiteSpace(status))
                status = current.Status;

            var progress = current.Progress;
            if (root.TryGetProperty("progress", out var progressEl))
            {
                if (progressEl.ValueKind == JsonValueKind.Number && progressEl.TryGetInt32(out var n))
                    progress = n;
                else if (progressEl.ValueKind == JsonValueKind.String)
                    progress = ParseProgress(progressEl.GetString(), current.Progress);
            }

            string? failure = null;
            if (status == "failed")
            {
                failure = ExtractFailure(root) ?? current.FailureMessage;
                if (string.IsNullOrWhiteSpace(failure))
                    failure = "Translation failed.";
            }

            return new StatusDto(status, Math.Clamp(progress, 0, 100), failure);
        }
        catch (JsonException)
        {
            return new StatusDto(current.Status, current.Progress, current.FailureMessage);
        }
    }

    private static int ParseProgress(string? raw, int fallback)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return fallback;

        var digits = new string(raw.Where(char.IsDigit).ToArray());
        return int.TryParse(digits, out var value) ? Math.Clamp(value, 0, 100) : fallback;
    }

    private static string? ExtractFailure(JsonElement root)
    {
        if (!root.TryGetProperty("derivatives", out var derivatives)
            || derivatives.ValueKind != JsonValueKind.Array)
            return null;

        var messages = new List<string>();
        foreach (var derivative in derivatives.EnumerateArray())
        {
            if (!derivative.TryGetProperty("messages", out var msgs)
                || msgs.ValueKind != JsonValueKind.Array)
                continue;

            foreach (var msg in msgs.EnumerateArray())
            {
                if (msg.TryGetProperty("message", out var text)
                    && text.GetString() is { Length: > 0 } s
                    && !messages.Contains(s))
                    messages.Add(s);
            }
        }

        return messages.Count == 0 ? null : string.Join("; ", messages);
    }
}
