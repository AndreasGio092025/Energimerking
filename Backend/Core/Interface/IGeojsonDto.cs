using NetTopologySuite.Features;

namespace Core.Interface;

public interface IGeojsonDto
{
    public Feature feature { get; set; }
}