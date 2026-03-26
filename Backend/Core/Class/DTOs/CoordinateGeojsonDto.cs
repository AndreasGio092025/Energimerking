using Core.Models;
using NetTopologySuite.Features;

namespace Core.Class.DTOs;

public class CoordinateGeojsonDto
{
    public Feature feature { get; set; }
    public CoordinateGeojsonDto(Coordinate coordinate)
    {
        var id = coordinate.Coordinateid;
        var latitude = coordinate.Geography.X;
        var longitude = coordinate.Geography.Y;
        var point = coordinate.Geography;
        var epsg = coordinate.Geography.SRID;
        var matrikkelKey = coordinate.MatrikkelNøkkel;
        var kommuneNr = coordinate.Kommunenummer;
        var gaardNr = coordinate.Gaardsnummer;
        var brukNr = coordinate.Bruksnummer;
        
        var attributes = new AttributesTable();
        attributes.Add("CoordinateId", id);
        attributes.Add("EPSG(SRID)", epsg);
        attributes.Add("Latitude", latitude);
        attributes.Add("Longitude", longitude);
        attributes.Add("Matrikkelnøkkel",matrikkelKey);
        attributes.Add("Kommunenummer",kommuneNr);
        attributes.Add("Gaardnummer", gaardNr);
        attributes.Add("Bruknummer", brukNr);
        
        feature = new(point, attributes);
    }
    
}