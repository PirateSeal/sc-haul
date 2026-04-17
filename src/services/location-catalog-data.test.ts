import { describe, expect, it } from 'vitest'
import { buildPersistedLocationCatalog } from '@/services/location-catalog-data'

const bodies = [
  {
    item_id: 1,
    System: 'Stanton',
    ObjectContainer: 'Stanton Star',
    InternalName: 'Stanton',
    Type: 'Star',
    XCoord: 0,
    YCoord: 0,
    ZCoord: 0,
  },
  {
    item_id: 2,
    System: 'Stanton',
    ObjectContainer: 'ArcCorp',
    InternalName: 'Stanton3',
    Type: 'Planet',
    XCoord: 100,
    YCoord: 200,
    ZCoord: 300,
  },
  {
    item_id: 3,
    System: 'Stanton',
    ObjectContainer: 'Yela',
    InternalName: 'Stanton2c',
    Type: 'Moon',
    XCoord: 400,
    YCoord: 500,
    ZCoord: 600,
  },
  {
    item_id: 4,
    System: 'Stanton',
    ObjectContainer: 'Wide Forest Station',
    InternalName: 'Stanton3_L1_station',
    Type: 'Refinery Station',
    XCoord: 700,
    YCoord: 800,
    ZCoord: 900,
  },
  {
    item_id: 5,
    System: 'Stanton',
    ObjectContainer: 'Wala',
    InternalName: 'Stanton3b',
    Type: 'Moon',
    XCoord: 150,
    YCoord: 250,
    ZCoord: 350,
  },
]

const pois = [
  {
    item_id: 11,
    System: 'Stanton',
    Planet: 'Yela',
    ObjectContainer: '',
    PoiName: 'Deakins Research Outpost',
    Type: 'Outpost',
    XCoord: 1,
    YCoord: 2,
    ZCoord: 3,
  },
  {
    item_id: 12,
    System: 'Stanton',
    Planet: 'Space',
    ObjectContainer: '',
    PoiName: 'Jump Point to Pyro',
    Type: 'Jump Point',
    XCoord: 1000,
    YCoord: 2000,
    ZCoord: 3000,
  },
]

describe('buildPersistedLocationCatalog', () => {
  it('merges starmap and UEX data into persisted location records', () => {
    const records = buildPersistedLocationCatalog({
      bodies,
      pois,
      cities: [
        {
          id: 1,
          name: 'Area 18',
          code: 'AR18',
          star_system_name: 'Stanton',
          planet_name: 'ArcCorp',
          moon_name: null,
          is_available_live: 1,
          is_visible: 1,
          has_freight_elevator: 0,
        },
      ],
      spaceStations: [
        {
          id: 9,
          name: 'Pyro Gateway (Stanton)',
          nickname: 'Pyro Gateway (Stanton)',
          star_system_name: 'Stanton',
          planet_name: null,
          moon_name: null,
          orbit_name: null,
          is_available_live: 1,
          is_visible: 1,
          is_jump_point: 1,
          has_freight_elevator: 0,
        },
        {
          id: 10,
          name: 'ARC-L1 Wide Forest Station',
          nickname: 'ARC-L1',
          star_system_name: 'Stanton',
          planet_name: 'ArcCorp',
          moon_name: null,
          orbit_name: 'ArcCorp Lagrange Point 1',
          is_available_live: 1,
          is_visible: 1,
          is_jump_point: 0,
          has_freight_elevator: 0,
        },
      ],
      outposts: [
        {
          id: 3,
          name: 'Deakins Research',
          nickname: 'Deakins',
          star_system_name: 'Stanton',
          planet_name: 'Crusader',
          moon_name: 'Yela',
          orbit_name: 'Crusader',
          is_available_live: 1,
          is_visible: 1,
          has_freight_elevator: 1,
        },
        {
          id: 7,
          name: 'No Freight Outpost',
          nickname: 'No Freight',
          star_system_name: 'Stanton',
          planet_name: 'ArcCorp',
          moon_name: 'Wala',
          orbit_name: 'ArcCorp',
          is_available_live: 1,
          is_visible: 1,
          has_freight_elevator: 0,
        },
      ],
      uexPois: [],
      terminals: [
        {
          id: 90,
          id_city: 1,
          id_outpost: 0,
          id_poi: 0,
          id_space_station: 0,
          name: 'TDD - Trade and Development Division - Area 18',
          fullname: 'Commodity Shop - TDD - Trade and Development Division - Area 18',
          displayname: 'Area 18',
          nickname: 'TDD Area 18',
          type: 'commodity',
          city_name: 'Area 18',
          outpost_name: null,
          space_station_name: null,
          star_system_name: 'Stanton',
          planet_name: 'ArcCorp',
          moon_name: null,
          orbit_name: 'ArcCorp',
          is_available_live: 1,
          is_visible: 1,
          has_freight_elevator: 1,
        },
        {
          id: 91,
          id_city: 0,
          id_outpost: 0,
          id_poi: 0,
          id_space_station: 10,
          name: 'Admin - ARC-L1',
          fullname: 'Commodity Shop - Admin - ARC-L1',
          displayname: 'ARC-L1 Wide Forest Station',
          nickname: 'ARC-L1',
          type: 'commodity',
          city_name: null,
          outpost_name: null,
          space_station_name: 'ARC-L1 Wide Forest Station',
          star_system_name: 'Stanton',
          planet_name: 'ArcCorp',
          moon_name: null,
          orbit_name: 'ArcCorp Lagrange Point 1',
          is_available_live: 1,
          is_visible: 1,
          has_freight_elevator: 1,
        },
      ],
    })

    const area18 = records.find((record) => record.displayName === 'Area 18')
    const lagrange = records.find((record) => record.displayName === 'ARC-L1 Wide Forest Station')
    const deakins = records.find((record) => record.displayName === 'Deakins Research Outpost')
    const noFreight = records.find((record) => record.displayName === 'No Freight Outpost')
    const gateway = records.find((record) => record.displayName === 'Pyro Gateway (Stanton)')

    expect(area18).toEqual(
      expect.objectContaining({
        source: 'uex-fallback',
        confidence: 'parent-fallback',
        coords: { x: 100, y: 200, z: 300 },
        hasFreightElevator: true,
        isUiSelectable: true,
      })
    )
    expect(area18?.uex?.cityId).toBe(1)
    expect(area18?.uex?.terminalIds).toEqual([90])

    expect(lagrange).toEqual(
      expect.objectContaining({
        source: 'uex-matched',
        hasFreightElevator: true,
        isUiSelectable: true,
      })
    )
    expect(lagrange?.aliases).toContain('ARC-L1')
    expect(lagrange?.searchTerms).toContain('ARC-L1')
    expect(lagrange?.normalizedNames).toContain('arc l1')

    expect(deakins).toEqual(
      expect.objectContaining({
        source: 'uex-matched',
        coords: { x: 400, y: 500, z: 600 },
        hasFreightElevator: true,
        isUiSelectable: true,
      })
    )

    expect(noFreight).toEqual(
      expect.objectContaining({
        source: 'uex-fallback',
        coords: { x: 150, y: 250, z: 350 },
        hasFreightElevator: false,
        isUiSelectable: false,
      })
    )

    expect(gateway).toEqual(
      expect.objectContaining({
        source: 'uex-fallback',
        confidence: 'gateway-fallback',
        coordOrigin: 'starmap-jump-point',
        coords: { x: 1000, y: 2000, z: 3000 },
      })
    )
  })
})
