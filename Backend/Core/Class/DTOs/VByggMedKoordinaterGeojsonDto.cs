using Core.Interface;
using Core.Models;
using NetTopologySuite.Features;

namespace Core.Class.DTOs;

public class VByggMedKoordinaterGeojsonDto : IGeojsonDto
{
    public Feature Feature { get; set; }

    public VByggMedKoordinaterGeojsonDto(VByggMedKoordinater byggMedKoordinater)
    {
        var adresse = byggMedKoordinater.Adresse;
        var lat = byggMedKoordinater.Geography.X;
        var lon = byggMedKoordinater.Geography.Y;
        var srid = byggMedKoordinater.Geography.SRID;
        var energibrukKwhM2 = byggMedKoordinater.EnergibrukKwhM2;
        
        var attributes = new AttributesTable();
        attributes.Add("Adresse", adresse);
        attributes.Add("Lat", lat);
        attributes.Add("Lon", lon);
        attributes.Add("Srid", srid);
        attributes.Add("EnergibrukKwhM2", energibrukKwhM2);
        
        Feature = new Feature(byggMedKoordinater.Geography,attributes);
    }
}