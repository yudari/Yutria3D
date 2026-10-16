namespace Yutria3D.Api.Services;

public interface IApsTokenService
{
    Task<(string Token, int ExpiresIn)> GetViewerTokenAsync(CancellationToken ct = default);
}
