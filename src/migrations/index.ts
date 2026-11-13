import * as migration_20261111_152432_initial from './20261111_152432_initial';
import * as migration_20261111_171055_claude_connections from './20261111_171055_claude_connections';
import * as migration_20261111_205754_brand_colours from './20261111_205754_brand_colours';
import * as migration_20261112_235053_add_image_tool from './20261112_235053_add_image_tool';
import * as migration_20261113_002024_design_blocks from './20261113_002024_design_blocks';
import * as migration_20261113_004837_designed_sections from './20261113_004837_designed_sections';

export const migrations = [
  {
    up: migration_20261111_152432_initial.up,
    down: migration_20261111_152432_initial.down,
    name: '20261111_152432_initial',
  },
  {
    up: migration_20261111_171055_claude_connections.up,
    down: migration_20261111_171055_claude_connections.down,
    name: '20261111_171055_claude_connections',
  },
  {
    up: migration_20261111_205754_brand_colours.up,
    down: migration_20261111_205754_brand_colours.down,
    name: '20261111_205754_brand_colours',
  },
  {
    up: migration_20261112_235053_add_image_tool.up,
    down: migration_20261112_235053_add_image_tool.down,
    name: '20261112_235053_add_image_tool',
  },
  {
    up: migration_20261113_002024_design_blocks.up,
    down: migration_20261113_002024_design_blocks.down,
    name: '20261113_002024_design_blocks',
  },
  {
    up: migration_20261113_004837_designed_sections.up,
    down: migration_20261113_004837_designed_sections.down,
    name: '20261113_004837_designed_sections'
  },
];
