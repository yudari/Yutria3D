using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yutria3D.Api.Services;

namespace Yutria3D.Api.Controllers;

public sealed record ViewerTokenResponse(string AccessToken, int ExpiresIn);

[ApiController]
[Route("api/auth")]
[Authorize]
public sealed class AuthTokenController : ControllerBase
{
    private readonly IApsTokenService _tokens;

    public AuthTokenController(IApsTokenService tokens)
    {
        _tokens = tokens;
    }

    [HttpGet("token")]
    public async Task<ActionResult<ViewerTokenResponse>> GetViewerToken(CancellationToken ct)
    {
        try
        {
            var (token, expiresIn) = await _tokens.GetViewerTokenAsync(ct);
            return Ok(new ViewerTokenResponse(token, expiresIn));
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new { error = "APS token request failed.", detail = ex.Message });
        }
    }
}
