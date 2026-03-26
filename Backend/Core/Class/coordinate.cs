using System;
using System.Collections.Generic;
using NetTopologySuite.Geometries;

namespace Core.Class;

public partial class coordinate
{
    public long coordinateid { get; set; }

    public double? longitude { get; set; }

    public double? latitude { get; set; }

    public Point? geography { get; set; }
}
