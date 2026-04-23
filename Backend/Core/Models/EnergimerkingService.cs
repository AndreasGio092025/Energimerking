using Core.Class.DTOs;
using Microsoft.EntityFrameworkCore;

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
        var dbSetList = await context.Coordinates.Where(c => c.Kommunenummer != null && c.Geography != null).ToListAsync();
        List<CoordinateGeojsonDto> list = dbSetList.Select(item=>new CoordinateGeojsonDto(item)).ToList();
        var jsonSerializer = new GeojsonSerializer<CoordinateGeojsonDto>(list);
        return jsonSerializer.Json;
    }
    
    public async Task<string> GetAmountCoordinateGeojson(int amount)
    {
        var dbSetList = await context.Coordinates.Where(c => c.Kommunenummer != null && c.Geography != null).Take(amount).ToListAsync();
        List<CoordinateGeojsonDto> list = dbSetList.Select(item=>new CoordinateGeojsonDto(item)).ToList();
        var jsonSerializer = new GeojsonSerializer<CoordinateGeojsonDto>(list);
        return jsonSerializer.Json;
    }
}