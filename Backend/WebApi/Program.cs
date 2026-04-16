using Core.Models;
using Microsoft.EntityFrameworkCore;

System.Globalization.CultureInfo.DefaultThreadCurrentCulture = 
    System.Globalization.CultureInfo.InvariantCulture;
System.Globalization.CultureInfo.DefaultThreadCurrentUICulture = 
    System.Globalization.CultureInfo.InvariantCulture;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<EnergimerkingContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("Postgres"),
        o => o.UseNetTopologySuite()
    )
);

var app = builder.Build();



    app.UseSwagger();
    app.UseSwaggerUI();


app.UseStaticFiles();
app.UseDefaultFiles();

app.UseHttpsRedirection();


app.MapControllers();




app.Run();



