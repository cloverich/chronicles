import type {
  Code,
  Construct,
  Effects,
  Extension,
  State,
  TokenizeContext,
  TokenType,
} from "micromark-util-types";

// ASCI Codes
const SPACE = 32;
const EXCLAMATION_MARK = 33;
const NUMBER_SIGN = 35;
const LEFT_SQUARE_BRACKET = 91;
const RIGHT_SQUARE_BRACKET = 93;
const VERTICAL_BAR = 124;

/**
 * Create an extension for `micromark` to enable OFM wikilink syntax.
 */
export function ofmWikilink(): Extension {
  return {
    text: {
      [LEFT_SQUARE_BRACKET]: {
        name: "ofmWikilink",
        tokenize: tokenize,
      },
      [EXCLAMATION_MARK]: {
        name: "ofmWikilink",
        tokenize: tokenize,
      },
    },
  };
}

/**
 * A tokenizer for Obsidian wikilink syntax.
 */
function tokenize(
  this: TokenizeContext,
  effects: Effects,
  ok: State,
  nok: State,
) {
  return start;

  /**
   * Start of wikilink
   *
   * ```markdown
   * > | ![[__path__#__hash__|__alias__]]
   *     ^^
   * ```
   */
  function start(code: Code) {
    if (code === EXCLAMATION_MARK) {
      effects.enter("ofmWikilink");
      effects.enter("ofmWikilinkEmbeddingMarker");
      effects.consume(code);
      effects.exit("ofmWikilinkEmbeddingMarker");
      return after_embedding_marker;
    }

    effects.enter("ofmWikilink");
    effects.enter("ofmWikilinkOpenMarker");
    effects.consume(code);
    return after_first_open;
  }

  /**
   * After the embedding marker `!`
   *
   * ```markdown
   * > | ![[__path__#__hash__|__alias__]]
   *     ^
   * ```
   */
  function after_embedding_marker(code: Code) {
    if (code !== LEFT_SQUARE_BRACKET) return nok(code);
    effects.enter("ofmWikilinkOpenMarker");
    effects.consume(code);
    return after_first_open;
  }

  /**
   * After the first open square bracket `[`
   *
   * ```markdown
   * > | [[__path__#__hash__|__alias__]]
   *     ^
   * ```
   */
  function after_first_open(code: Code) {
    if (code !== LEFT_SQUARE_BRACKET) return nok(code);
    effects.consume(code);
    effects.exit("ofmWikilinkOpenMarker");
    return after_second_open;
  }

  /**
   * After the second open square bracket `[`
   *
   * ```markdown
   * > | [[__path__#__hash__|__alias__]]
   * 	    ^
   * ```
   */
  function after_second_open(code: Code) {
    if (code === SPACE) {
      effects.enter("ofmWikilinkWhiteSpace");
      effects.consume(code);
      return open_whitespace;
    }

    if (code === NUMBER_SIGN) {
      effects.enter("ofmWikilinkHashMarker");
      effects.consume(code);
      effects.exit("ofmWikilinkHashMarker");
      return after_hash_marker;
    }

    if (code === VERTICAL_BAR) {
      effects.enter("ofmWikilinkAliasMarker");
      effects.consume(code);
      effects.exit("ofmWikilinkAliasMarker");
      return after_alias_marker;
    }

    if (code === RIGHT_SQUARE_BRACKET) {
      effects.enter("ofmWikilinkCloseMarker");
      effects.consume(code);
      return after_first_close;
    }

    if (code && code > SPACE) {
      effects.enter("ofmWikilinkPath");
      effects.consume(code);
      return path;
    }

    return nok(code);
  }

  /**
   * Inside first group of whitespace
   *
   * ```markdown
   * > | [[__path__#__hash__|__alias__]]
   * 	     ^^
   * ```
   */
  function open_whitespace(code: Code) {
    if (code === SPACE) {
      effects.consume(code);
      return open_whitespace;
    }

    if (code === NUMBER_SIGN) {
      effects.exit("ofmWikilinkWhiteSpace");
      effects.enter("ofmWikilinkHashMarker");
      effects.consume(code);
      effects.exit("ofmWikilinkHashMarker");
      return after_hash_marker;
    }

    if (code === VERTICAL_BAR) {
      effects.exit("ofmWikilinkWhiteSpace");
      effects.enter("ofmWikilinkAliasMarker");
      effects.consume(code);
      effects.exit("ofmWikilinkAliasMarker");
      return after_alias_marker;
    }

    if (code === RIGHT_SQUARE_BRACKET) {
      effects.exit("ofmWikilinkWhiteSpace");
      effects.enter("ofmWikilinkCloseMarker");
      effects.consume(code);
      return after_first_close;
    }

    if (code && code > SPACE) {
      effects.exit("ofmWikilinkWhiteSpace");
      effects.enter("ofmWikilinkPath");
      effects.consume(code);
      return path;
    }

    return nok(code);
  }

  /**
   * Inside the path
   *
   * ```markdown
   * > | [[__path__#__hash__|__alias__]]
   * 	       ^^^^
   * ```
   */
  function path(code: Code) {
    if (code === NUMBER_SIGN) {
      effects.exit("ofmWikilinkPath");
      effects.enter("ofmWikilinkHashMarker");
      effects.consume(code);
      effects.exit("ofmWikilinkHashMarker");
      return after_hash_marker;
    }

    if (code === VERTICAL_BAR) {
      effects.exit("ofmWikilinkPath");
      effects.enter("ofmWikilinkAliasMarker");
      effects.consume(code);
      effects.exit("ofmWikilinkAliasMarker");
      return after_alias_marker;
    }

    if (code === RIGHT_SQUARE_BRACKET) {
      effects.exit("ofmWikilinkPath");
      effects.enter("ofmWikilinkCloseMarker");
      effects.consume(code);
      return after_first_close;
    }

    if (code === SPACE) {
      return effects.attempt(
        create_whitespace_tokenizer("ofmWikilinkPath", true, true),
        after_content_whitespace,
        function (code) {
          effects.consume(code);
          return path;
        },
      )(code);
    }

    if (code && code > SPACE) {
      effects.consume(code);
      return path;
    }

    return nok(code);
  }

  /**
   * Inside the whitespace after the path
   *
   * ```markdown
   * > | [[__path__#__hash__|__alias__]]
   * 	            ^
   * ```
   */
  function after_content_whitespace(code: Code) {
    if (code === NUMBER_SIGN) {
      effects.enter("ofmWikilinkHashMarker");
      effects.consume(code);
      effects.exit("ofmWikilinkHashMarker");
      return after_hash_marker;
    }

    if (code === VERTICAL_BAR) {
      effects.enter("ofmWikilinkAliasMarker");
      effects.consume(code);
      effects.exit("ofmWikilinkAliasMarker");
      return after_alias_marker;
    }

    if (code === RIGHT_SQUARE_BRACKET) {
      effects.enter("ofmWikilinkCloseMarker");
      effects.consume(code);
      return after_first_close;
    } /* v8 ignore next */
    return nok(code);
  }

  /**
   * After the hash marker `#`
   *
   * ```markdown
   * > | [[__path__#__hash__|__alias__]]
   * 	             ^
   * ```
   */
  function after_hash_marker(code: Code) {
    if (code === SPACE) {
      effects.enter("ofmWikilinkWhiteSpace");
      effects.consume(code);
      return hash_whitespace;
    }

    if (code === VERTICAL_BAR) {
      effects.enter("ofmWikilinkAliasMarker");
      effects.consume(code);
      effects.exit("ofmWikilinkAliasMarker");
      return after_alias_marker;
    }

    if (code === RIGHT_SQUARE_BRACKET) {
      effects.enter("ofmWikilinkCloseMarker");
      effects.consume(code);
      return after_first_close;
    }

    if (code && code > SPACE) {
      effects.enter("ofmWikilinkHash");
      effects.consume(code);
      return hash;
    }

    return nok(code);
  }

  /**
   * Inside the second group of whitespace
   *
   * ```markdown
   * > | [[__path__#__hash__|__alias__]]
   * 	              ^^
   * ```
   */
  function hash_whitespace(code: Code) {
    if (code === SPACE) {
      effects.consume(code);
      return hash_whitespace;
    }

    if (code === VERTICAL_BAR) {
      effects.exit("ofmWikilinkWhiteSpace");
      effects.enter("ofmWikilinkAliasMarker");
      effects.consume(code);
      effects.exit("ofmWikilinkAliasMarker");
      return after_alias_marker;
    }

    if (code === RIGHT_SQUARE_BRACKET) {
      effects.exit("ofmWikilinkWhiteSpace");
      effects.enter("ofmWikilinkCloseMarker");
      effects.consume(code);
      return after_first_close;
    }

    if (code && code > SPACE) {
      effects.exit("ofmWikilinkWhiteSpace");
      effects.enter("ofmWikilinkHash");
      effects.consume(code);
      return hash;
    }

    return nok(code);
  }

  /**
   * Inside the hash
   *
   * ```markdown
   * > | [[__path__#__hash__|__alias__]]
   * 	               	^^^^
   * ```
   */
  function hash(code: Code) {
    if (code === VERTICAL_BAR) {
      effects.exit("ofmWikilinkHash");
      effects.enter("ofmWikilinkAliasMarker");
      effects.consume(code);
      effects.exit("ofmWikilinkAliasMarker");
      return after_alias_marker;
    }

    if (code === RIGHT_SQUARE_BRACKET) {
      effects.exit("ofmWikilinkHash");
      effects.enter("ofmWikilinkCloseMarker");
      effects.consume(code);
      return after_first_close;
    }

    if (code === SPACE) {
      return effects.attempt(
        create_whitespace_tokenizer("ofmWikilinkHash", false, true),
        after_hash_whitespace,
        function (code) {
          effects.consume(code);
          return hash;
        },
      )(code);
    }

    if (code && code > SPACE) {
      effects.consume(code);
      return hash;
    }

    return nok(code);
  }

  /**
   * Inside the whitespace after the path
   *
   * ```markdown
   * > | [[__path__#__hash__|__alias__]]
   * 	                     ^
   * ```
   */
  function after_hash_whitespace(code: Code) {
    if (code === VERTICAL_BAR) {
      effects.enter("ofmWikilinkAliasMarker");
      effects.consume(code);
      effects.exit("ofmWikilinkAliasMarker");
      return after_alias_marker;
    }

    if (code === RIGHT_SQUARE_BRACKET) {
      effects.enter("ofmWikilinkCloseMarker");
      effects.consume(code);
      return after_first_close;
    } /* v8 ignore next */
    return nok(code);
  }

  /**
   * After the alias marker `|`
   *
   * ```markdown
   * > | [[__path__#__hash__|__alias__]]
   * 	                      ^
   * ```
   */
  function after_alias_marker(code: Code) {
    if (code === SPACE) {
      effects.enter("ofmWikilinkWhiteSpace");
      effects.consume(code);
      return alias_whitespace;
    }

    if (code === RIGHT_SQUARE_BRACKET) {
      effects.enter("ofmWikilinkCloseMarker");
      effects.consume(code);
      return after_first_close;
    }

    if (code && code > SPACE) {
      effects.enter("ofmWikilinkAlias");
      effects.consume(code);
      return alias;
    }

    return nok(code);
  }

  /**
   * Inside the third group of whitespace
   *
   * ```markdown
   * > | [[__path__#__hash__|__alias__]]
   * 	                       ^^
   * ```
   */
  function alias_whitespace(code: Code) {
    if (code === SPACE) {
      effects.consume(code);
      return alias_whitespace;
    }

    if (code === RIGHT_SQUARE_BRACKET) {
      effects.exit("ofmWikilinkWhiteSpace");
      effects.enter("ofmWikilinkCloseMarker");
      effects.consume(code);
      return after_first_close;
    }

    if (code && code > SPACE) {
      effects.exit("ofmWikilinkWhiteSpace");
      effects.enter("ofmWikilinkAlias");
      effects.consume(code);
      return alias;
    }

    return nok(code);
  }

  /**
   * Inside the alias
   *
   * ```markdown
   * > | [[__path__#__hash__|__alias__]]
   * 	                       	 ^^^^^
   * ```
   */
  function alias(code: Code) {
    if (code === RIGHT_SQUARE_BRACKET) {
      effects.exit("ofmWikilinkAlias");
      effects.enter("ofmWikilinkCloseMarker");
      effects.consume(code);
      return after_first_close;
    }

    if (code === SPACE) {
      return effects.attempt(
        create_whitespace_tokenizer("ofmWikilinkAlias", false, false),
        after_alias_whitespace,
        function (code) {
          effects.consume(code);
          return alias;
        },
      )(code);
    }

    if (code && code > SPACE) {
      effects.consume(code);
      return alias;
    }

    return nok(code);
  }

  /**
   * Inside the whitespace after the path
   *
   * ```markdown
   * > | [[__path__#__hash__|__alias__]]
   * 	                               ^
   * ```
   */
  function after_alias_whitespace(code: Code) {
    if (code === RIGHT_SQUARE_BRACKET) {
      effects.enter("ofmWikilinkCloseMarker");
      effects.consume(code);
      return after_first_close;
    } /* v8 ignore next */
    return nok(code);
  }

  /**
   * After the first close square bracket `]`
   *
   * ```markdown
   * > | [[__path__#__hash__|__alias__]]
   * 	                                ^
   * ```
   */
  function after_first_close(code: Code) {
    if (code !== RIGHT_SQUARE_BRACKET) return nok(code);
    effects.consume(code);
    effects.exit("ofmWikilinkCloseMarker");
    effects.exit("ofmWikilink");
    return ok(code);
  }
}

function create_whitespace_tokenizer(
  exit_type: TokenType,
  allow_number_sign: boolean,
  allow_vertical_bar: boolean,
): Construct {
  return {
    tokenize: function (effects, ok, nok) {
      return start;

      /**
       * Start of potential suffix whitespace
       *
       * ```markdown
       * > | [[__path__#__hash__|__alias__]]
       * 	           ^        ^         ^
       * ```
       */
      function start(code: Code) {
        effects.exit(exit_type);
        effects.enter("ofmWikilinkWhiteSpace");
        effects.consume(code);
        return white_space;
      }

      /**
       * Inside potential suffix whitespace
       *
       * ```markdown
       * > | [[__path__#__hash__|__alias__]]
       * 	            ^        ^         ^
       * ```
       */
      function white_space(code: Code) {
        if (code === SPACE) {
          effects.consume(code);
          return white_space;
        }

        if (allow_number_sign && code === NUMBER_SIGN) {
          effects.exit("ofmWikilinkWhiteSpace");
          return ok(code);
        }

        if (allow_vertical_bar && code === VERTICAL_BAR) {
          effects.exit("ofmWikilinkWhiteSpace");
          return ok(code);
        }

        if (code === RIGHT_SQUARE_BRACKET) {
          effects.exit("ofmWikilinkWhiteSpace");
          return ok(code);
        }

        return nok(code);
      }
    },
  };
}
