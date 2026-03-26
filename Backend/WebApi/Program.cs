using ef_core_migration_test.Models;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.IO.Converters;
using System.Net;




var builder = WebApplication.CreateBuilder(args);


builder.Services.AddDbContext<EnergimerkingContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("Postgres"),
        o => o.UseNetTopologySuite()
    )
);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new GeoJsonConverterFactory());
    });

var app = builder.Build();

app.MapControllers();



app.MapGet("/", (EnergimerkingContext dbContext) => dbContext.energimerkes.Take(100).ToList());

app.Run();
// run app