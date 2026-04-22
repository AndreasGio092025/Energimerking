/* Pseudo/forklaring
 * Hvis det finnes flere eiendoms-modeller på ett koordinat må de samles og legges i en GeojsonDto.
 * 
 */

using Core.Interface;
using Core.Models;
using NetTopologySuite.Features;

namespace Core.Class.DTOs;

public class FlereEiendommerEttKoordGeojsonDto : IGeojsonDto
{
    public Feature feature { get; set; }

    public FlereEiendommerEttKoordGeojsonDto(Coordinate coord, List<Eiendom> eiendommer)
    {
        var id = coord.Coordinateid;
        var latitude = coord.Geography.X;
        var longitude = coord.Geography.Y;
        var point = coord.Geography;
        var epsg = coord.Geography.SRID;
        var matrikkelKey = coord.MatrikkelNøkkel;
        var kommuneNr = coord.Kommunenummer;
        var gaardNr = coord.Gaardsnummer;
        var brukNr = coord.Bruksnummer;
        
        var eiendomsIdListe = eiendommer.Select(e => e.EiendomId).ToList();
        
        var attributes = new AttributesTable();
        attributes.Add("CoordinateId", id);
        attributes.Add("EPSG(SRID)", epsg);
        attributes.Add("Latitude", latitude);
        attributes.Add("Longitude", longitude);
        attributes.Add("Matrikkelnøkkel",matrikkelKey);
        attributes.Add("Kommunenummer",kommuneNr);
        attributes.Add("Gaardnummer", gaardNr);
        attributes.Add("Bruknummer", brukNr);
        attributes.Add("Eiendommer",eiendomsIdListe);
        
        feature = new(point, attributes);
    }
}