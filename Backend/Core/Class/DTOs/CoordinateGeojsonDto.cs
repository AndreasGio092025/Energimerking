using Core.Class;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;

namespace ef_core_migration_test.Models.DTOs;

public class CoordinateGeojsonDto
{
    public Feature feature { get; set; }
    public CoordinateGeojsonDto(coordinate coordinate)
    {
        var id = coordinate.coordinateid;
        var latitude = coordinate.geography.X;
        var longitude = coordinate.geography.Y;
        var point = coordinate.geography;
        var epsg = coordinate.geography.SRID;
        
        var attributes = new AttributesTable();
        attributes.Add("CoordinateId", id);
        attributes.Add("EPSG(SRID)", epsg);
        attributes.Add("Latitude", latitude);
        attributes.Add("Longitude", longitude);
        
        feature = new(point, attributes);
    }
}