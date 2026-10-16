using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Yutria3D.Api.Auth;

public sealed class JwtService
{
    private readonly IConfiguration _config;

    public JwtService(IConfiguration config)
    {
        _config = config;
    }

    public (string Token, int ExpiresIn) IssueToken(string userId, string email)
    {
        var key = _config["JWT_KEY"] ?? string.Empty;
        if (string.IsNullOrWhiteSpace(key) || Encoding.UTF8.GetBytes(key).Length < 32)
            throw new InvalidOperationException("JWT_KEY is not configured (min 32 bytes).");

        var expiresIn = 8 * 3600;
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId),
            new Claim(ClaimTypes.NameIdentifier, userId),
            new Claim(JwtRegisteredClaimNames.Email, email ?? string.Empty),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddSeconds(expiresIn),
            signingCredentials: credentials);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresIn);
    }
}
