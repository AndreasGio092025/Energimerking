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

    public int? Kommunenummer { get; set; }

    public int? Gaardsnummer { get; set; }

    public int? Bruksnummer { get; set; }
}
