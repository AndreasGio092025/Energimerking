using Core.Class.DTOs;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite;
using NetTopologySuite.Features;

namespace Core.Models;

public class EnergimerkingService(EnergimerkingContext context) : DbContext
{
    /// <summary>
    /// Looks at every coordinate, filtering out any that doesn't have "Kommunenummer" or Geography.
    /// Is prone to crashing web-browser.
    /// Result will likely exceed 40mb.
    /// </summary>
    /// <returns>Gives a serialized string of all coordinates</returns>
    public async Task<string> GetAllCoordinateGeojson()
    {
        var dbSetList = await context.Coordinates.Where(c => c.Kommunenummer != null && c.Geography != null)
            .ToListAsync();
        List<CoordinateGeojsonDto> list = dbSetList.Select(item => new CoordinateGeojsonDto(item)).ToList();
        var jsonSerializer = new GeojsonSerializer<CoordinateGeojsonDto>(list);
        return jsonSerializer.Json;
    }

    public async Task<string> GetAmountCoordinateGeojson(int amount)
    {
        var dbSetList = await context.Coordinates.Where(c => c.Kommunenummer != null && c.Geography != null)
            .Take(amount).ToListAsync();
        List<CoordinateGeojsonDto> list = dbSetList.Select(item => new CoordinateGeojsonDto(item)).ToList();
        var jsonSerializer = new GeojsonSerializer<CoordinateGeojsonDto>(list);
        return jsonSerializer.Json;
    }

    /// <summary>
    /// Lager et geografisk punkt som blir brukt til å gjøre utspørringer etter koordinater innenfor
    /// radiusen bruker gir og setter sammen eiendommene med koordinater.
    /// MERK! Fungerer ikke optimalt. Vil gi feilmeldinger om utspørringen til databasen tar lang tid.
    /// </summary>
    /// <param name="latitude">breddegrad</param>
    /// <param name="longitude">lengdegrad</param>
    /// <param name="amount">Hvor mange koordinater</param>
    /// <param name="radiusInMeters">radius</param>
    /// <returns>En string i geojson-format</returns>
    public async Task<string> GetNearbyGeoJson(
        double latitude,
        double longitude,
        int amount,
        double radiusInMeters = 5000)
    {
        if (radiusInMeters <= 0 || radiusInMeters > 50000)
        {
            return "Radius må være mellom 1 og 50 000 meter.";
        }

        try
        {
            var factory = NtsGeometryServices.Instance.CreateGeometryFactory(srid: 4258);


            var searchPoint = factory.CreatePoint(
                new NetTopologySuite.Geometries.Coordinate(longitude, latitude)
            );
            
            //Finner koordinater innenfor søkepunktet, og
            //returnerer en utspørringsliste med koordinat som nøkkel og en utspørringsliste med eiendommer som
            //er knyttet til nøkkelen.
            var coordinates = context.Coordinates
                .Where(c =>
                    c.Geography != null &&
                    c.Geography.IsWithinDistance(searchPoint, radiusInMeters)
                )
                .Take(amount)
                .GroupBy(c => c, value => context.Coordinates.SelectMany(c_inner =>
                    context.Eiendoms.Where(e => e.Coordinateid == c_inner.Coordinateid)));

            var dtoList = await coordinates.Select(item =>
                new FlereEiendommerEttKoordGeojsonDto(item.Key, item.SelectMany(i => i))).ToListAsync();

            var jsonSerializer = new GeojsonSerializer<FlereEiendommerEttKoordGeojsonDto>(dtoList);

            return jsonSerializer.Json;
        }
        catch (Exception ex)
        {
            return $"Feil ved søk: {ex.Message}";
        }
    }
    
}