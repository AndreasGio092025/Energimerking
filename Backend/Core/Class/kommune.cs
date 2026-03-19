using System;
using System.Collections.Generic;

namespace ef_core_migration_test.Models;

public partial class kommune
{
    public string kommunenummer { get; set; } = null!;

    public string navn { get; set; } = null!;

    public virtual ICollection<eiendom> eiendoms { get; set; } = new List<eiendom>();
}
