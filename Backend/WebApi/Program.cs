using System.Text.Json.Serialization;
using Core.Models;
using Microsoft.EntityFrameworkCore;
using EnergimerkingContext = Core.DbContexts.EnergimerkingContext;

System.Globalization.CultureInfo.DefaultThreadCurrentCulture = 
    System.Globalization.CultureInfo.InvariantCulture;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals;
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<EnergimerkingContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("Postgres"),
        o => o.UseNetTopologySuite()
    )
);

builder.Services.AddScoped<EnergimerkingService>();
builder.Services.AddScoped<WebApi.Services.TileService>();
builder.Services.AddScoped<WebApi.Services.ByggOversiktService>();
builder.Services.AddScoped<WebApi.Services.EnheterService>();
builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();

// Komprimerer svarene (Brotli eller gzip, etter hva nettleseren ber om). Punktsvaret for en bydel er
// ca. 9,6 MB ukomprimert; GeoJSON med gjentatte feltnavn pakker seg godt. Nettleseren pakker ut selv,
// så JSON-formatet og frontend er uendret.
// EnableForHttps: trygt her fordi svarene ikke har innlogging, tokens eller andre hemmeligheter
// (BREACH-angrep krever hemmeligheter i samme svar som tekst angriperen styrer).
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProvider>();
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProvider>();
    options.MimeTypes = Microsoft.AspNetCore.ResponseCompression.ResponseCompressionDefaults.MimeTypes
        .Concat(["application/vnd.mapbox-vector-tile"]);
});
// Fastest: Optimal-nivået for Brotli bruker for mye CPU på svar på flere MB.
builder.Services.Configure<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProviderOptions>(
    o => o.Level = System.IO.Compression.CompressionLevel.Fastest);
builder.Services.Configure<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProviderOptions>(
    o => o.Level = System.IO.Compression.CompressionLevel.Fastest);

var app = builder.Build();

// Først i rekken, så alle svar under (også feilsvar og statiske filer) kan komprimeres.
app.UseResponseCompression();

// Felles feilhåndtering: uventede feil logges, og klienten får aldri unntakstekst eller stack trace
// (heller ikke i Development, der ASP.NET ellers viser detaljene).
app.UseExceptionHandler(feil => feil.Run(async ctx =>
{
    ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
    ctx.Response.ContentType = "text/plain; charset=utf-8";
    await ctx.Response.WriteAsync("Noe gikk galt på serveren. Prøv igjen senere.");
}));

    app.UseSwagger();
    app.UseSwaggerUI();


app.UseStaticFiles();
app.UseDefaultFiles();

app.UseHttpsRedirection();


app.MapControllers();




app.Run();



