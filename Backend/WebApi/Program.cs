using System.Text.Json.Serialization;
using Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using EnergimerkingContext = Core.DbContexts.EnergimerkingContext;

System.Globalization.CultureInfo.DefaultThreadCurrentCulture = 
    System.Globalization.CultureInfo.InvariantCulture;

var builder = WebApplication.CreateBuilder(args);

//Cross Origin Resource Sharing
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy => 
        policy.AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod());
});

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
builder.Services.AddScoped<TileService>();

var app = builder.Build();

    app.UseSwagger();
    app.UseSwaggerUI();


app.UseCors();
app.UseStaticFiles();
app.UseDefaultFiles();

app.UseHttpsRedirection();


app.MapControllers();

app.MapGet("/", () => "Tile server running");


app.Run();



