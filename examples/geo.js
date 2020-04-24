const zipfile = "state.zip"
const tract_file = "tract.json"

const year = '2014"
const fips = "48"
const projection =
  "d3.geoConicEqualArea().parallels([34, 40.5]).rotate([120, 0]).fitSize([960, 960], d)";
async function main() {
  // get the shapefiles.
  await shell`wget 
    -O ${zipfile} 
    'http://www2.census.gov/geo/tiger/GENZ2014/shp/cb_${year}_${fips}_tract_500k.zip'`
    .pipe(shell`unzip ${zipfile}`)
    .end();

  // get the census data.
  await shell`wget 
    -O ${tractfile}
    "https://api.census.gov/data/2018/acs/acs5?get=B01003_001E&for=tract:*&in=state:${fips}"`
    .end()

  shell`shp2json cb_${year}_${fips}_tract_500k.shp` // state_json
    .pipe(shell`geoproject ${projection}`) //state_albers
    .pipe(shell`ndjson-split 'd.features'`) // state_albers_ndjson
    .pipe(shell`ndjson-map 'd.id = d.properties.GEOID.slice(2), d'`) //state_albers_id

  shell`cat ${tractfile}` // census_pop_tract_ndjson
    .pipe(shell`ndjson-cat`)
    .pipe(shell`ndjson-split 'd.slice(1)'`)
    .pipe(shell`ndjson-map '{id: d[2] + d[3], B01003: +d[0]}'`)

  shell
    .stdin()
    .stdin()
    .pipe(shell`ndjson-join 'd.id'`) // state_pop_join_ndjson
    .pipe(shell`ndjson-map 'd[0].properties = {density: Math.floor(d[1].B01003 / d[0].properties.ALAND * 2589975.2356)}, d[0]'`) // state_density_ndjson
    .pipe(shell`geo2topo -n tracts=-`) // state_tracts_topo
    .pipe(shell`toposimplify -p 1 -f`) // state-tracts_simple_topo
    .pipe(shell`topoquantize 1e5`) // state_tracts-quantied_topo
    .pipe(shell`topomerge -k 'd.id.slice(0,3)' counties=tracts`) //state_county_merge_topo
    .pipe(shell`topomerge --mesh -f 'a !== b' counties=counties`) // state_topo
    .pipe(shell`topo2geo tracts=-`) // state_svg1
    .pipe(shell`ndjson-map -r d3 d3-scale-chromatic 'z = d3.scaleThreshold().domain([1, 10, 50, 200, 500, 1000, 2000, 4000]).range(d3.schemeOrRd[9]), d.features.forEach(f => f.properties.fill = z(f.properties.density)), d'`)
    .pipe(shell`ndjson-split 'd.features'`)
    .end()

    .pipe(shell`topo2geo counties=-`) // state_svg2
    .pipe(shell`ndjson-map 'd.properties = {"stroke": "#000", "stroke-opacity": 0.3}, d'`)

  shell`geo2svg -n --stroke none -p 1 -w 960 -h 960`
    .redirect('state.svg')
}

main()
