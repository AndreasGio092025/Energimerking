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


CREATE OR REPLACE FUNCTION get_mvt_advanced(z INT, x INT, y INT)
RETURNS bytea
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
WITH tile AS (
    SELECT ST_TileEnvelope(z, x, y) AS geom
),

-- STEP 1: transform once
base AS (
    SELECT
        id,
        adresse,
        "energikarakter",
        "oppvarmingskarakter",
        "beregnetLevertEnergiTotaltkWhm2"::double precision AS energy,

        ST_Transform(
            ST_SetSRID(coordinate::geometry, 4258),
            3857
        ) AS geom

    FROM denorm_matrikkel_og_enova_oslo
    WHERE coordinate IS NOT NULL
),

-- STEP 2: filter to tile
filtered AS (
    SELECT b.*, t.geom AS tile_geom
    FROM base b, tile t
    WHERE b.geom && t.geom
),

-- =========================
-- CLUSTERING (low zoom)
-- =========================
clusters AS (
    SELECT
        ST_SnapToGrid(geom, 
            CASE
                WHEN z < 10 THEN 500
                WHEN z < 13 THEN 200
                ELSE 50
            END
        ) AS grid,

        COUNT(*) AS point_count,
        AVG(energy) AS avg_energy

    FROM filtered
    WHERE z < 13
    GROUP BY grid
),

clusters_mvt AS (
    SELECT
        point_count,
        avg_energy,

        ST_AsMVTGeom(
            ST_Centroid(grid),
            t.geom,   
            4096,
            256,
            true
        ) AS geom

    FROM clusters
    CROSS JOIN tile t
),

-- =========================
-- RAW POINTS (high zoom)
-- =========================
points AS (
    SELECT
        id,
        energikarakter,
        energy,

        ST_AsMVTGeom(
            geom,
            tile_geom,  
            4096,
            256,
            true
        ) AS geom

    FROM filtered
    WHERE z >= 13
    LIMIT 8000
),

-- =========================
-- STATS LAYER (optional)
-- =========================
stats AS (
    SELECT
        COUNT(*) AS total_points,
        AVG(energy) AS avg_energy
    FROM filtered
),

stats_mvt AS (
    SELECT
        total_points,
        avg_energy,

        ST_AsMVTGeom(
            ST_Centroid(t.geom),
            t.geom
        ) AS geom

    FROM stats
    CROSS JOIN tile t
)

-- =========================
-- FINAL TILE (multi-layer)
-- =========================
SELECT
    COALESCE(
        (SELECT ST_AsMVT(points, 'points', 4096, 'geom') FROM points),
        '\x'::bytea
    ) ||
    COALESCE(
        (SELECT ST_AsMVT(clusters_mvt, 'clusters', 4096, 'geom') FROM clusters_mvt),
        '\x'::bytea
    ) ||
    COALESCE(
        (SELECT ST_AsMVT(stats_mvt, 'stats', 4096, 'geom') FROM stats_mvt),
        '\x'::bytea
    );
$$;