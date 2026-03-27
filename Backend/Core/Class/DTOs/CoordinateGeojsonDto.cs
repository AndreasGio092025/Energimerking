using Core.Models;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;

namespace Core.Class.DTOs;

public class CoordinateGeojsonDto
{
    public Feature Feature { get; }

    public CoordinateGeojsonDto(VByggMedKoordinater dto)
    {
        if (dto == null)
            throw new ArgumentNullException(nameof(dto));

        if (dto.Geography == null)
            throw new ArgumentException("Geometri (Geography) mangler i VByggMedKoordinater.", nameof(dto));

        // Opprett attributter
        var attributes = new AttributesTable
        {
            { "CoordinateId", dto.Coordinateid },
            { "Bygningsnummer", dto.Bygningsnummer },
            { "Bruksnummmer",  dto.Bruksnummer },
            { "Adresse", dto.Adresse },
            { "Postnummer", dto.Postnummer },
            { "Poststed", dto.Poststed },
            { "Kommunenavn", dto.Kommunenavn },
            { "EPSG", dto.Geography.SRID },
            { "Latitude", dto.Latitude },          
            { "Longitude", dto.Longitude },        

           
            { "Energikarakter", dto.Energikarakter },
            { "EnergikarakterBeskrivelse", dto.EnergikarakterBeskrivelse },
            { "Oppvarmingskarakter", dto.Oppvarmingskarakter },
            { "EnergibrukKwhM2", dto.EnergibrukKwhM2 },
            { "BeregnetFossilandel", dto.BeregnetFossilandel },
            { "HarEnergivurdering", dto.HarEnergivurdering ?? false },
            { "EnergivurderingDato", dto.EnergivurderingDato?.ToString("yyyy-MM-dd") },
            { "Kilde", dto.Kilde }
        };

        
        Feature = new Feature(dto.Geography, attributes);
    }
}