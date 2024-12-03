import type {
  Code,
  Effects,
  Extension,
  State,
  TokenizeContext,
} from "micromark-util-types";

// ASCI Codes
const SPACE = 32;
const NUMBER_SIGN = 35;
const DASH = 45;
const SLASH = 47;
const DIGIT_0 = 48;
const DIGIT_9 = 57;
const LETTER_A = 65;
const LETTER_Z = 90;
const UNDERSCORE = 95;
const LETTER_a = 97;
const LETTER_z = 122;

/**
 * Create an extension for `micromark` to enable OFM tag syntax.
 */
export function ofmTag(): Extension {
  return {
    text: {
      [NUMBER_SIGN]: {
        name: "ofmTag",
        tokenize: tokenize,
      },
    },
  };
}

/**
 * A tokenizer for Obsidian tag syntax.
 * The tag must include at least one non-numerical character.
 */
function tokenize(
  this: TokenizeContext,
  effects: Effects,
  ok: State,
  nok: State,
) {
  const previous = this.previous;
  const events = this.events;
  return start;

  /**
   * Start of tag
   *
   * ```markdown
   * > | #123/tag
   *     ^
   * ```
   */
  function start(code: Code) {
    // Only tags can be chained directly without space
    if (
      previous &&
      previous > SPACE &&
      events[events.length - 1][1].type !== "ofmTag"
    ) {
      return nok(code);
    }

    effects.enter("ofmTag");
    effects.enter("ofmTagMarker");
    effects.consume(code);
    effects.exit("ofmTagMarker");
    effects.enter("ofmTagContent");
    return inside_tag_candidate;
  }

  /**
   * Inside a tag without any non-numerical character
   *
   * ```markdown
   * > | #123/tag
   *      ^^^
   * ```
   */
  function inside_tag_candidate(code: Code) {
    if (code && code >= DIGIT_0 && code <= DIGIT_9) {
      effects.consume(code);
      return inside_tag_candidate;
    }

    if (
      code &&
      ((code >= LETTER_A && code <= LETTER_Z) ||
        (code >= LETTER_a && code <= LETTER_z) ||
        code === UNDERSCORE ||
        code === DASH ||
        code === SLASH)
    ) {
      effects.consume(code);
      return inside_tag;
    }

    return nok(code);
  }

  /**
   * Inside a tag with at least one non-numerical character
   *
   * ```markdown
   * > | #123/tag
   *         ^^^^
   * ```
   */
  function inside_tag(code: Code) {
    if (
      code &&
      ((code >= DIGIT_0 && code <= DIGIT_9) ||
        (code >= LETTER_A && code <= LETTER_Z) ||
        (code >= LETTER_a && code <= LETTER_z) ||
        code === UNDERSCORE ||
        code === DASH ||
        code === SLASH)
    ) {
      effects.consume(code);
      return inside_tag;
    }

    effects.exit("ofmTagContent");
    effects.exit("ofmTag");
    return ok(code);
  }
}
