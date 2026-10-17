using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Yutria3D.Api.Data;
using Yutria3D.Api.Options;
using Yutria3D.Api.Services;

var builder = WebApplication.CreateBuilder(args);

Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();

builder.Services.AddControllers();
builder.Services.AddProblemDetails();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.Configure<ApsOptions>(builder.Configuration.GetSection(ApsOptions.SectionName));

var apsMaxUploadMb = builder.Configuration.GetValue<int?>("Aps:MaxUploadMb")
    ?? builder.Configuration.GetValue<int?>("MAX_UPLOAD_MB")
    ?? 100;
builder.Services.PostConfigure<ApsOptions>(aps =>
{
    if (aps.MaxUploadMb <= 0)
        aps.MaxUploadMb = Math.Max(1, apsMaxUploadMb);
    if (string.IsNullOrWhiteSpace(aps.Bucket))
        aps.Bucket = builder.Configuration["APS_BUCKET"] ?? "yutria3d-bucket";
    if (string.IsNullOrWhiteSpace(aps.ClientId))
        aps.ClientId = builder.Configuration["APS_CLIENT_ID"] ?? string.Empty;
    if (string.IsNullOrWhiteSpace(aps.ClientSecret))
        aps.ClientSecret = builder.Configuration["APS_CLIENT_SECRET"] ?? string.Empty;
});

var maxUploadBytes = (long)Math.Max(1, apsMaxUploadMb) * 1024 * 1024;
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(form =>
    form.MultipartBodyLengthLimit = maxUploadBytes);
builder.WebHost.ConfigureKestrel(kestrel =>
    kestrel.Limits.MaxRequestBodySize = maxUploadBytes);

var connectionString = builder.Configuration.GetConnectionString("Default");
if (string.IsNullOrWhiteSpace(connectionString))
{
    connectionString = builder.Configuration["DATABASE_URL"];
}
var databaseUrl = connectionString ?? string.Empty;

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

builder.Services.AddIdentityCore<IdentityUser>(options =>
{
    options.Password.RequireDigit = false;
    options.Password.RequireLowercase = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequiredLength = 6;
    options.User.RequireUniqueEmail = true;
})
    .AddEntityFrameworkStores<AppDbContext>();

builder.Services.AddSingleton<Yutria3D.Api.Auth.JwtService>();
builder.Services.AddScoped<Yutria3D.Api.Auth.AuthService>();
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
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient<IApsTokenService, ApsTokenService>();
builder.Services.AddHttpClient<IApsClient, ApsClient>(client =>
    client.BaseAddress = new Uri("https://developer.api.autodesk.com/"))
    .AddStandardResilienceHandler();
builder.Services.AddHttpClient("aps-s3", client =>
{
    client.Timeout = TimeSpan.FromMinutes(30);
});

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
app.MapControllers();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
    .WithName("Health")
    .WithOpenApi();

app.Run();

public partial class Program;
