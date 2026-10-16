using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Yutria3D.Api.Options;

namespace Yutria3D.Api.Services;

public sealed class ApsTokenService : IApsTokenService
{
    private const string ViewerCacheKey = "aps-viewer-token";
    private const string ViewerScope = "viewables:read";
    private const string DataScope = "data:read data:write data:create bucket:create bucket:read";
    private static readonly Uri DefaultBaseAddress = new("https://developer.api.autodesk.com/");

    private readonly HttpClient _http;
    private readonly ApsOptions _options;
    private readonly IMemoryCache _cache;

    public ApsTokenService(HttpClient http, IOptions<ApsOptions> options, IMemoryCache cache)
    {
        _http = http;
        _options = options.Value;
        _cache = cache;
        if (_http.BaseAddress is null)
            _http.BaseAddress = DefaultBaseAddress;
    }

    public Task<(string Token, int ExpiresIn)> GetViewerTokenAsync(CancellationToken ct = default)
    {
        if (_cache.TryGetValue<(string Token, int ExpiresIn)>(ViewerCacheKey, out var cached))
            return Task.FromResult(cached);

        return FetchAndCacheAsync(ViewerScope, ViewerCacheKey, ct);
    }

    public Task<(string Token, int ExpiresIn)> GetDataTokenAsync(CancellationToken ct = default)
        => FetchAndCacheAsync(DataScope, null, ct);

    private async Task<(string Token, int ExpiresIn)> FetchAndCacheAsync(string scope, string? cacheKey, CancellationToken ct)
    {
        using var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = _options.ClientId,
            ["client_secret"] = _options.ClientSecret,
            ["grant_type"] = "client_credentials",
            ["scope"] = scope,
        });

        using var res = await _http.PostAsync("authentication/v2/token", form, ct);
        res.EnsureSuccessStatusCode();

        var body = await res.Content.ReadFromJsonAsync<TokenResponse>(ct)
            ?? throw new InvalidOperationException("Empty APS token response.");

        var result = (body.AccessToken, body.ExpiresIn);
        if (cacheKey is not null && body.ExpiresIn > 60)
            _cache.Set(cacheKey, result, TimeSpan.FromSeconds(body.ExpiresIn - 60));

        return result;
    }

    private sealed record TokenResponse(
        [property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("expires_in")] int ExpiresIn);
}
