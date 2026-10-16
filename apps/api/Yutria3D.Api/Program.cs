using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Yutria3D.Api.Data;
using Yutria3D.Api.Options;

var builder = WebApplication.CreateBuilder(args);

Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();

builder.Services.AddProblemDetails();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.Configure<ApsOptions>(builder.Configuration.GetSection(ApsOptions.SectionName));

var databaseUrl = builder.Configuration.GetConnectionString("Default")
    ?? builder.Configuration["DATABASE_URL"]
    ?? string.Empty;

builder.Services.AddDbContext<AppDbContext>(options =>
{
    if (string.IsNullOrWhiteSpace(databaseUrl))
    {
        options.UseInMemoryDatabase("yutria3d");
    }
    else
    {
        options.UseNpgsql(databaseUrl);
    }
});

builder.Services.AddIdentityCore<IdentityUser>()
    .AddEntityFrameworkStores<AppDbContext>();

var jwtKey = builder.Configuration["JWT_KEY"] ?? string.Empty;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        if (!string.IsNullOrWhiteSpace(jwtKey))
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            };
        }
    });
builder.Services.AddAuthorization();

var webOrigin = builder.Configuration["WEB_ORIGIN"] ?? "http://localhost:5173";
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy => policy
        .WithOrigins(webOrigin)
        .AllowAnyHeader()
        .AllowAnyMethod());
});

var app = builder.Build();

app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseExceptionHandler();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
    .WithName("Health")
    .WithOpenApi();

app.Run();

public partial class Program;
