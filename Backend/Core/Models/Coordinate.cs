using System;
using System.Collections.Generic;
using NetTopologySuite.Geometries;

namespace Core.Models;

public partial class Coordinate
{
    public long Coordinateid { get; set; }

    public double? Longitude { get; set; }

    public double? Latitude { get; set; }

    public Point? Geography { get; set; }

    public string? MatrikkelNøkkel { get; set; }

    public string? Kommunenummer { get; set; }

    public int? Gaardsnummer { get; set; }

    public int? Bruksnummer { get; set; }

    public string Lokalid { get; set; } = null!;

    public string? Adresse { get; set; }

    public virtual ICollection<EiendomBygning> EiendomBygnings { get; set; } = new List<EiendomBygning>();

    public virtual ICollection<Eiendom> Eiendoms { get; set; } = new List<Eiendom>();
}
