using System;
using Core.Interface;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore.Query;
using Npgsql;

namespace WebApi.Services;

public class TileService : ITileService
{
    
    private readonly string _connectionString;

    public TileService(IConfiguration config)
    {
        _connectionString = config.GetConnectionString("DefaultConnection");
    }
    
    public async Task<byte[]?> GetTileAsync(
        int z,
        int x,
        int y,
        string[]? ratings,
        double? minKwh,
        double? maxKwh)
    {
        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        var sql = @"
            SELECT ST_AsMVT(tile, 'buildings', 4096, 'geom') AS mvt
            FROM (
                SELECT
                    bygningsnummer,
                    adresse,
                    energikarakter,
                    energibruk_kwh_m2,

                    ST_AsMVTGeom(
                        geography::geometry,
                        ST_TileEnvelope(@z, @x, @y),
                        4096,
                        64,
                        true
                    ) AS geom -- ST_AsMVTGeom gjør 2 ting her. Clipping: hvis litt av en byggning er innenfor rektangelet blir det tatt med. Clipping hindrer dette
                    -- Tiles bruker ikke lat/lng, de bruker et rutenett. Default extent er 0 -> 4096. Her ble det gjordt til 64 -> 4096, 64 for å gi den en buffer og hindrer at man ser sømmene mellom tiles.

                FROM public.v_bygg_med_koordinater

                WHERE geography::geometry && ST_TileEnvelope(@z, @x, @y) -- Denne delen finner byggningene innenfor tilen.

                AND (@ratings IS NULL OR energikarakter = ANY(@ratings))
                AND (@minKwh IS NULL OR energibruk_kwh_m2 >= @minKwh)
                AND (@maxKwh IS NULL OR energibruk_kwh_m2 <= @maxKwh)

            ) AS tile;"; 
        
        await using var cmd = new NpgsqlCommand(sql, conn);

        cmd.Parameters.AddWithValue("z", z);
        cmd.Parameters.AddWithValue("x", x);
        cmd.Parameters.AddWithValue("y", y);

        cmd.Parameters.AddWithValue("ratings", 
        ratings != null && ratings.Length > 0
                ? ratings
                : (object)DBNull.Value);
        
        cmd.Parameters.AddWithValue("minKwh",
            (object?)minKwh ?? DBNull.Value);

        cmd.Parameters.AddWithValue("maxKwh",
            (object?)maxKwh ?? DBNull.Value);
        
        await using var reader = await cmd.ExecuteReaderAsync();

        if(!await reader.ReadAsync())
            return null;
        
        return reader["mvt"] as byte[];
    }
    
}
