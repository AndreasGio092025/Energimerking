using System;
using System.Collections.Generic;

namespace Core.Models;

public partial class EiendomBygning
{
    public long BygningeiendomId { get; set; }

    public long EiendomId { get; set; }

    public long BygningId { get; set; }

    public long? Coordinateid { get; set; }

    public virtual Bygning Bygning { get; set; } = null!;

    public virtual Coordinate? Coordinate { get; set; }

    public virtual Eiendom Eiendom { get; set; } = null!;

    public virtual ICollection<Energimerke> Energimerkes { get; set; } = new List<Energimerke>();
}
