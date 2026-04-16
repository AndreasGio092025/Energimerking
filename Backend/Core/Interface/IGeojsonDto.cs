using NetTopologySuite.Features;

namespace Core.Interface;
/// <summary>
/// Lagrer Feature-en som skal brukes i GeojsonSerializer.
/// </summary>
public interface IGeojsonDto
{
    public Feature feature { get; set; }
}