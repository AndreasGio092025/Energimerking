CREATE OR REPLACE FUNCTION get_mvt_points_debug(z INT, x INT, y INT)
RETURNS bytea
LANGUAGE sql
AS $$
WITH
tile AS (
    SELECT ST_TileEnvelope(z, x, y) AS tile_geom
),

points AS (
    SELECT
        id,
        adresse,
        "energikarakter",
        "oppvarmingskarakter",
        "beregnetLevertEnergiTotaltkWhm2",

        ST_AsMVTGeom(
            ST_Transform(
                ST_SetSRID(coordinate::geometry, 4258),
                3857
            ),
            tile.tile_geom,
            4096,
            256,
            true
        ) AS geom

    FROM denorm_matrikkel_og_enova_oslo, tile

    WHERE coordinate IS NOT NULL
      AND ST_Transform(
            ST_SetSRID(coordinate::geometry, 4258),
            3857
          ) && tile.tile_geom

    LIMIT 10000
)

SELECT ST_AsMVT(points, 'points', 4096, 'geom')
FROM points
WHERE geom IS NOT NULL;
$$;