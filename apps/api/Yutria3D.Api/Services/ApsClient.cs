using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using Yutria3D.Api.Helpers;
using Yutria3D.Api.Options;

namespace Yutria3D.Api.Services;

public sealed class ApsClient : IApsClient
{
    private const string DataScope = "data:read data:write data:create bucket:create bucket:read";
    private static readonly Uri DefaultBaseAddress = new("https://developer.api.autodesk.com/");

    private readonly HttpClient _http;
    private readonly ApsOptions _options;
    private string? _token;
    private DateTime _tokenExpiresAt;

    public ApsClient(HttpClient http, IOptions<ApsOptions> options)
    {
        _http = http;
        _options = options.Value;
        if (_http.BaseAddress is null)
            _http.BaseAddress = DefaultBaseAddress;
    }

    public async Task EnsureBucketAsync(string bucketKey, CancellationToken ct = default)
    {
        using var details = new HttpRequestMessage(HttpMethod.Get, $"oss/v2/buckets/{bucketKey}/details");
        await AuthorizeAsync(details, ct);
        using var res = await _http.SendAsync(details, ct);
        if (res.StatusCode != HttpStatusCode.NotFound)
        {
            res.EnsureSuccessStatusCode();
            return;
        }

        using var create = new HttpRequestMessage(HttpMethod.Post, "oss/v2/buckets")
        {
            Content = JsonContent.Create(new { bucketKey, policyKey = "persistent" }),
        };
        await AuthorizeAsync(create, ct);
        using var created = await _http.SendAsync(create, ct);
        created.EnsureSuccessStatusCode();
    }

    public async Task<string> SignedS3UploadAsync(Stream content, string bucketKey, string objectKey, CancellationToken ct = default)
    {
        var encodedKey = Uri.EscapeDataString(objectKey);

        using var sign = new HttpRequestMessage(HttpMethod.Get,
            $"oss/v2/buckets/{bucketKey}/objects/{encodedKey}/signeds3upload");
        await AuthorizeAsync(sign, ct);
        using var signRes = await _http.SendAsync(sign, ct);
        signRes.EnsureSuccessStatusCode();
        var signed = await signRes.Content.ReadFromJsonAsync<SignedUrlsResponse>(ct)
            ?? throw new InvalidOperationException("Empty signed upload response.");
        if (signed.Urls.Length == 0 || string.IsNullOrWhiteSpace(signed.UploadKey))
            throw new InvalidOperationException("APS did not return signed upload URLs.");

        using var body = new MemoryStream();
        await content.CopyToAsync(body, ct);
        var bytes = body.ToArray();

        var partSize = (bytes.Length + signed.Urls.Length - 1) / signed.Urls.Length;
        for (var i = 0; i < signed.Urls.Length; i++)
        {
            var chunk = bytes.AsMemory(i * partSize, Math.Min(partSize, bytes.Length - (i * partSize)));
            using var put = new HttpRequestMessage(HttpMethod.Put, signed.Urls[i])
            {
                Content = new ByteArrayContent(chunk.ToArray()),
            };
            put.Content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            using var putRes = await _http.SendAsync(put, ct);
            putRes.EnsureSuccessStatusCode();
        }

        using var complete = new HttpRequestMessage(HttpMethod.Post,
            $"oss/v2/buckets/{bucketKey}/objects/{encodedKey}/signeds3upload")
        {
            Content = JsonContent.Create(new { uploadKey = signed.UploadKey }),
        };
        await AuthorizeAsync(complete, ct);
        using var completeRes = await _http.SendAsync(complete, ct);
        completeRes.EnsureSuccessStatusCode();
        var done = await completeRes.Content.ReadFromJsonAsync<CompleteUploadResponse>(ct)
            ?? throw new InvalidOperationException("Empty complete-upload response.");
        if (string.IsNullOrWhiteSpace(done.ObjectId))
            throw new InvalidOperationException("APS did not return an objectId.");

        return done.ObjectId;
    }

    public async Task StartTranslationAsync(string objectId, CancellationToken ct = default)
    {
        using var job = new HttpRequestMessage(HttpMethod.Post, "modelderivative/v2/designdata/job")
        {
            Content = JsonContent.Create(new TranslationJob(
                new JobInput(Urn.ToBase64UrlNoPadding(objectId)),
                new JobOutput([new JobFormat("svf2", ["2d", "3d"])]))),
        };
        await AuthorizeAsync(job, ct);
        using var res = await _http.SendAsync(job, ct);
        res.EnsureSuccessStatusCode();
    }

    public async Task<string?> GetManifestAsync(string urn, CancellationToken ct = default)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, $"modelderivative/v2/designdata/{urn}/manifest");
        await AuthorizeAsync(req, ct);
        using var res = await _http.SendAsync(req, ct);
        if (res.StatusCode == HttpStatusCode.NotFound)
            return null;

        res.EnsureSuccessStatusCode();
        return await res.Content.ReadAsStringAsync(ct);
    }

    public async Task DeleteObjectAsync(string bucketKey, string objectKey, CancellationToken ct = default)
    {
        using var req = new HttpRequestMessage(HttpMethod.Delete,
            $"oss/v2/buckets/{bucketKey}/objects/{Uri.EscapeDataString(objectKey)}");
        await AuthorizeAsync(req, ct);
        using var res = await _http.SendAsync(req, ct);
        if (res.StatusCode == HttpStatusCode.NotFound)
            return;

        res.EnsureSuccessStatusCode();
    }

    public async Task DeleteManifestAsync(string urn, CancellationToken ct = default)
    {
        using var req = new HttpRequestMessage(HttpMethod.Delete, $"modelderivative/v2/designdata/{urn}/manifest");
        await AuthorizeAsync(req, ct);
        using var res = await _http.SendAsync(req, ct);
        if (res.StatusCode == HttpStatusCode.NotFound)
            return;

        res.EnsureSuccessStatusCode();
    }

    private async Task AuthorizeAsync(HttpRequestMessage request, CancellationToken ct)
    {
        if (_token is null || DateTime.UtcNow >= _tokenExpiresAt)
        {
            using var form = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = _options.ClientId,
                ["client_secret"] = _options.ClientSecret,
                ["grant_type"] = "client_credentials",
                ["scope"] = DataScope,
            });
            using var res = await _http.PostAsync("authentication/v2/token", form, ct);
            res.EnsureSuccessStatusCode();
            var body = await res.Content.ReadFromJsonAsync<TokenResponse>(ct)
                ?? throw new InvalidOperationException("Empty APS token response.");
            _token = body.AccessToken;
            _tokenExpiresAt = DateTime.UtcNow.AddSeconds(Math.Max(30, body.ExpiresIn - 60));
        }

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _token);
    }

    private sealed record TokenResponse(
        [property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("expires_in")] int ExpiresIn);

    private sealed record SignedUrlsResponse(
        [property: JsonPropertyName("urls")] string[] Urls,
        [property: JsonPropertyName("uploadKey")] string UploadKey);

    private sealed record CompleteUploadResponse(
        [property: JsonPropertyName("objectId")] string ObjectId);

    private sealed record TranslationJob(
        [property: JsonPropertyName("input")] JobInput Input,
        [property: JsonPropertyName("output")] JobOutput Output);

    private sealed record JobInput(
        [property: JsonPropertyName("urn")] string Urn);

    private sealed record JobOutput(
        [property: JsonPropertyName("formats")] JobFormat[] Formats);

    private sealed record JobFormat(
        [property: JsonPropertyName("type")] string Type,
        [property: JsonPropertyName("views")] string[] Views);
}
