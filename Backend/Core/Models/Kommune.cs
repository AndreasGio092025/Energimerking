using System;
using System.Collections.Generic;

namespace Core.Models;

public partial class Kommune
{
    public string Kommunenummer { get; set; } = null!;

    public string Navn { get; set; } = null!;

    public virtual ICollection<Eiendom> Eiendoms { get; set; } = new List<Eiendom>();
}
