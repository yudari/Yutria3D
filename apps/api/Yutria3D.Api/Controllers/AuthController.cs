using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Yutria3D.Api.Auth;
namespace Yutria3D.Api.Controllers;

public sealed record RegisterRequest(string Email, string Password);
public sealed record LoginRequest(string Email, string Password);
public sealed record AuthResponse(string Token);

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly AuthService _auth;

    public AuthController(AuthService auth)
    {
        _auth = auth;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Email and password are required." });

        var result = await _auth.RegisterAsync(req.Email, req.Password, ct);
        if (!result.Succeeded)
            return BadRequest(new { error = result.Error });

        return Ok(new AuthResponse(result.Token!));
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Email and password are required." });

        var result = await _auth.LoginAsync(req.Email, req.Password, ct);
        if (!result.Succeeded)
            return Unauthorized(new { error = result.Error });

        return Ok(new AuthResponse(result.Token!));
    }
}
