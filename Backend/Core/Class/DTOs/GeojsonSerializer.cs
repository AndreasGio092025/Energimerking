using System.Text.Json;
using Core.Interface;
using NetTopologySuite.Features;
using NetTopologySuite.IO.Converters;

namespace Core.Class.DTOs;

public class GeojsonSerializer<TDto> where TDto : IGeojsonDto
{
    public string Json;

    public GeojsonSerializer(List<TDto> dtos)
    {
        List<Feature> featureList = dtos.Select(model => model.feature).ToList();
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