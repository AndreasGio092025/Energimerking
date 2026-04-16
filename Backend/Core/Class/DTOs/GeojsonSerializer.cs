using System.Text.Json;
using Core.Interface;
using NetTopologySuite.Features;
using NetTopologySuite.IO.Converters;

namespace Core.Class.DTOs;
/// <summary>
/// Tar inn en liste med Dto-objekter og lager en FeatureCollection med alle features fra Dto-objektene.
/// FeatureCollection-en blir deretter serialisert.
/// </summary>
/// <typeparam name="TDto">Ser på Featuren i modellen</typeparam>
public class GeojsonSerializer<TDto> where TDto : IGeojsonDto
{
    public string Json;

    /// <summary>
    /// Lager en liste av Features som deretter blir lagt inn i en FeatureCollection.
    /// Fra der serialiseres FeatureCollection-en.
    /// </summary>
    /// <param name="dtos">Listen med Dtoene som har features på seg.</param>
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