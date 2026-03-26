using System;
using System.Collections.Generic;

namespace Core.Models;

public partial class Energikarakter
{
    public string Bokstav { get; set; } = null!;

    public string Beskrivelse { get; set; } = null!;

    public virtual ICollection<Energimerke> Energimerkes { get; set; } = new List<Energimerke>();
}
