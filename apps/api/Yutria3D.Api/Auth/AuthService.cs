using Microsoft.AspNetCore.Identity;

namespace Yutria3D.Api.Auth;

public sealed class AuthResult
{
    public bool Succeeded { get; init; }
    public string? Token { get; init; }
    public string? Error { get; init; }

    public static AuthResult Ok(string token) => new() { Succeeded = true, Token = token };
    public static AuthResult Fail(string error) => new() { Succeeded = false, Error = error };
}

public sealed class AuthService
{
    private readonly UserManager<IdentityUser> _users;
    private readonly JwtService _jwt;

    public AuthService(UserManager<IdentityUser> users, JwtService jwt)
    {
        _users = users;
        _jwt = jwt;
    }

    public async Task<AuthResult> RegisterAsync(string email, string password, CancellationToken ct = default)
    {
        email = email.Trim().ToLowerInvariant();
        var existing = await _users.FindByEmailAsync(email);
        if (existing is not null)
            return AuthResult.Fail("Email already registered.");

        var user = new IdentityUser { UserName = email, Email = email };
        var result = await _users.CreateAsync(user, password);
        if (!result.Succeeded)
            return AuthResult.Fail(string.Join("; ", result.Errors.Select(e => e.Description)));

        var (token, _) = _jwt.IssueToken(user.Id, user.Email ?? email);
        return AuthResult.Ok(token);
    }

    public async Task<AuthResult> LoginAsync(string email, string password, CancellationToken ct = default)
    {
        email = email.Trim().ToLowerInvariant();
        var user = await _users.FindByEmailAsync(email);
        if (user is null)
            return AuthResult.Fail("Invalid email or password.");

        if (!await _users.CheckPasswordAsync(user, password))
            return AuthResult.Fail("Invalid email or password.");

        var (token, _) = _jwt.IssueToken(user.Id, user.Email ?? email);
        return AuthResult.Ok(token);
    }
}
