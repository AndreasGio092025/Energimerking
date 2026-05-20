using Core.Interface;
using Core.Models;
using NetTopologySuite.Features;

namespace Core.Class.DTOs;

public class DenormMatrikkelOgEnovaOsloGeojsonDto : IGeojsonDto
{
    public Feature Feature { get; set; }

    public DenormMatrikkelOgEnovaOsloGeojsonDto(List<DenormMatrikkelOgEnovaOslo> denormData)
    {
        var point = denormData[0].Coordinate;
        var adresse = denormData[0].Adresse;
        var kommune = denormData[0].KommuneNr;
        var gård = denormData[0].GaardsNr;
        var bruk = denormData[0].BruksNr;
        //Legger ikke alle attestene på en eiendom. (samme eiendom kan dukke opp med ny attest)
        var eiendommer = denormData.Select(d => new
        {
            denormId = d.Id,
            feste = d.FesteNr,
            andel = d.AndelsNr,
            seksjon = d.SeksjonsNr,
            bruksenhetsNr = d.BruksenhetsNr,
            organisasjonsNr = d.OrganisasjonsNr,
            attestnummer = d.AttestNr,
            utstedelsesdato = d.UtstedelsesDato,
            energikarakter = d.Energikarakter,
            oppvarmingskarakter = d.Oppvarmingskarakter,
            beregnetLevertEnergiTotaltkWhm2 = d.BeregnetLevertEnergiTotaltkWhm2,
            materialvalg = d.Matierialvalg,
            byggeår = d.Byggeår
        });
        //zzz
        
        var attributes = new AttributesTable();
        attributes.Add("adresse", adresse);
        attributes.Add("kommune", kommune);
        attributes.Add("gård", gård);
        attributes.Add("bruk", bruk);
        attributes.Add("eiendommer",eiendommer);
        
        
        Feature = new(point, attributes);
    }
}