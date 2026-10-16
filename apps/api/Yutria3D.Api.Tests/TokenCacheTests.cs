using System.Net;
using System.Text;
using Microsoft.Extensions.Caching.Memory;
using Yutria3D.Api.Options;
using Yutria3D.Api.Services;

namespace Yutria3D.Api.Tests;

public sealed class TokenCacheTests
{
    private sealed class CountingHandler : HttpMessageHandler
    {
        private readonly Func<int, string> _payload;
        public int CallCount { get; private set; }

        public CountingHandler(Func<int, string> payload) => _payload = payload;

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            CallCount++;
            var json = _payload(CallCount);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            });
        }
    }

    private static ApsTokenService CreateService(
        CountingHandler handler, IMemoryCache cache, out CountingHandler captured)
    {
        captured = handler;
        var http = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://developer.api.autodesk.com"),
        };
        var options = Microsoft.Extensions.Options.Options.Create(new ApsOptions
        {
            ClientId = "test-id",
            ClientSecret = "test-secret",
            Bucket = "test-bucket",
        });
        return new ApsTokenService(http, options, cache);
    }

    private static string TokenJson(string token, int expiresIn) =>
        $$"""{"access_token":"{{token}}","token_type":"Bearer","expires_in":{{expiresIn}}}""";

    [Fact]
    public async Task SecondCall_WithinValidity_DoesNotCallServiceAgain()
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = CreateService(
            new CountingHandler(_ => TokenJson("viewer-token-1", 3600)), cache, out var handler);

        var first = await service.GetViewerTokenAsync();
        var second = await service.GetViewerTokenAsync();

        Assert.Equal("viewer-token-1", first.Token);
        Assert.Equal(first.Token, second.Token);
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task AfterEviction_CallsServiceAgain()
    {
        var cache = new MemoryCache(new MemoryCacheOptions());
        var service = CreateService(
            new CountingHandler(call => TokenJson($"viewer-token-{call}", 3600)), cache, out var handler);

        var first = await service.GetViewerTokenAsync();
        cache.Compact(1.0);
        var second = await service.GetViewerTokenAsync();
        cache.Dispose();

        Assert.Equal("viewer-token-1", first.Token);
        Assert.Equal("viewer-token-2", second.Token);
        Assert.Equal(2, handler.CallCount);
    }
}
