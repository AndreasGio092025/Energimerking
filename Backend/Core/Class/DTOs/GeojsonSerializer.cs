using System.Text.Json;
using NetTopologySuite.Features;
using NetTopologySuite.IO.Converters;

namespace Core.Class.DTOs;

public class GeojsonSerializer
{
    public string Json;

    public GeojsonSerializer(List<CoordinateGeojsonDto> coordinateGeojsonDtos)
    {
        List<Feature> featureList = coordinateGeojsonDtos.Select(coordGeojsonDto => coordGeojsonDto.feature).ToList();
        var featureCollection = new FeatureCollection();
        featureList.ForEach(feature => featureCollection.Add(feature));
        
        var options = new JsonSerializerOptions
        {
            Converters = { new GeoJsonConverterFactory() },
            // Optional: for pretty formatting
            WriteIndented = true 
        };
        Json = JsonSerializer.Serialize(featureCollection, options);
    }
}