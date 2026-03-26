using Core.Models;
using Microsoft.EntityFrameworkCore;
using System.Net;




var builder = WebApplication.CreateBuilder(args);


builder.Services.AddDbContext<EnergimerkingContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("Postgres"),
        o => o.UseNetTopologySuite()
    )
);

var app = builder.Build();



app.MapGet("/",(EnergimerkingContext
 dbContext)=> dbContext.Energimerkes);

app.Run();
// run app