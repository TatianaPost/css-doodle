import parse_css from './parser/parse-css';
import parse_grid from './parser/parse-grid';
import generator from './generator';
import get_props from './utils/get-props';

class Doodle extends HTMLElement {
  constructor() {
    super();
    this.doodle = this.attachShadow({ mode: 'open' });
    this.extra = {
      get_custom_property_value: this.get_custom_property_value.bind(this)
    };
  }
  connectedCallback() {
    setTimeout(() => {
      let compiled;
      let use = this.getAttribute('use') || '';
      if (use) use = `@use:${ use };`;
      if (!this.innerHTML.trim() && !use) return false;
      try {
        let parsed = parse_css(use + this.innerHTML, this.extra);
        this.grid_size = parse_grid(this.getAttribute('grid'));
        compiled = generator(parsed, this.grid_size);
        compiled.grid && (this.grid_size = compiled.grid);
        this.build_grid(compiled);
      } catch (e) {
        this.innerHTML = '';
        console.error(e && e.message || 'Error in css-doodle.');
      }
    });
  }

  get_custom_property_value(name) {
    return getComputedStyle(this).getPropertyValue(name)
      .trim()
      .replace(/^\(|\)$/g, '');
  }

  build_grid(compiled) {
    const { has_transition, has_animation } = compiled.props;
    const { keyframes, host, container, cells } = compiled.styles;

    this.doodle.innerHTML = `
      <style>
        ${ this.style_basic() }
      </style>
      <style class="style-keyframes">
        ${ keyframes }
      </style>
      <style class="style-container">
        ${ this.style_size() }
        ${ host }
        ${ container }
      </style>
      <style class="style-cells">
        ${ (has_transition || has_animation) ? '' : cells }
      </style>
      <div class="container">
        ${ this.html_cells() }
      </div>
    `;

    if (has_transition || has_animation) {
      setTimeout(() => {
        this.set_style('.style-cells', cells);
      }, 50);
    }
  }

  inherit_props(p) {
    return get_props(/grid/)
      .map(n => `${ n }: inherit;`).join('');
  }

  style_basic() {
    return `
      :host {
        display: block;
        visibility: visible;
        width: 1em;
        height: 1em;
      }
      .container {
        position: relative;
        width: 100%;
        height: 100%;
        display: grid;
        ${ this.inherit_props() }
      }
      .cell {
        position: relative;
        line-height: 1;
        box-sizing: border-box;
        display: flex;
        justify-content: center;
        align-items: center;
      }
    `;
  }

  style_size() {
    let { x, y } = this.grid_size;
    return `
      :host {
        grid-template-rows: repeat(${ x }, 1fr);
        grid-template-columns: repeat(${ y }, 1fr);
      }
    `;
  }

  html_cells() {
    return '<div class="cell"></div>'
      .repeat(this.grid_size.count);
  }

  set_style(selector, styles) {
    const el = this.shadowRoot.querySelector(selector);
    el && (el.styleSheet
      ? (el.styleSheet.cssText = styles )
      : (el.innerHTML = styles));
  }

  update(styles) {
    let use = this.getAttribute('use') || '';
    if (use) use = `@use:${ use };`;

    if (!styles) styles = this.innerHTML;
    this.innerHTML = styles;

    if (!this.grid_size) {
      this.grid_size = parse_grid(this.getAttribute('grid'));
    }

    const compiled = generator(parse_css(use + styles, this.extra), this.grid_size);

    if (compiled.grid) {
      let { x, y } = compiled.grid;
      if (this.grid_size.x !== x || this.grid_size.y !== y) {
        Object.assign(this.grid_size, compiled.grid);
        return this.build_grid(compiled);
      }
      Object.assign(this.grid_size, compiled.grid);
    }

    else {
      let grid = parse_grid(this.getAttribute('grid'));
      let { x, y } = grid;
      if (this.grid_size.x !== x || this.grid_size.y !== y) {
        Object.assign(this.grid_size, grid);
        return this.build_grid(
          generator(parse_css(use + styles, this.extra), this.grid_size)
        );
      }
    }

    this.set_style('.style-keyframes',
      compiled.styles.keyframes
    );
    this.set_style('.style-container',
        this.style_size()
      + compiled.styles.host
      + compiled.styles.container
    );
    this.set_style('.style-cells',
      compiled.styles.cells
    );
  }

  get grid() {
    return Object.assign({}, this.grid_size);
  }

  set grid(grid) {
    this.setAttribute('grid', grid);
    this.connectedCallback();
  }

  get use() {
    return this.getAttribute('use');
  }

  set use(use) {
    this.setAttribute('use', use);
    this.connectedCallback();
  }

  static get observedAttributes() {
    return ['grid', 'use'];
  }

  attributeChangedCallback(name, old_val, new_val) {
    if (old_val == new_val) {
      return false;
    }
    if (name == 'grid' && old_val) {
      this.grid = new_val;
    }
    if (name == 'use' && old_val) {
      this.use = new_val;
    }
  }
}

customElements.define('css-doodle', Doodle);
