using System;

namespace Core.Interface;

public interface ITileService
{
    Task<byte[]?> GetTileAsync(
        int z,
        int x,
        int y,
        string[]? ratings,
        double? minKwh,
        double? maxKwh
    );
}
