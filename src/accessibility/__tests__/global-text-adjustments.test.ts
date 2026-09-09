/**
 * Testes da funcao pura `adjustTextStyle`: multiplier 1 nao altera o estilo,
 * multiplier > 1 escala `fontSize`/`lineHeight`.
 *
 * `PixelRatio.getFontScale` e mockado retornando 1 porque outro trabalho em
 * andamento planeja compor `adjustTextStyle` com o fontScale do sistema; fixar
 * o mock em 1 mantem este teste estavel independente dessa mudanca.
 */
import { PixelRatio } from "react-native";

jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(1);

import {
  adjustTextStyle,
  COMBINED_FONT_SCALE_CAP,
  DEFAULT_GLOBAL_ACCESSIBILITY_STATE,
  getEffectiveFontScaleMultiplier,
  type GlobalAccessibilityState,
} from "../global-text-adjustments";

describe("adjustTextStyle", () => {
  it("nao altera o estilo quando o multiplier e 1 e alto contraste esta desligado", () => {
    const style = { fontSize: 16, lineHeight: 20, color: "#333333" };

    const result = adjustTextStyle(style, DEFAULT_GLOBAL_ACCESSIBILITY_STATE);

    expect(result).toBe(style);
  });

  it("escala fontSize e lineHeight, limitados pelo teto combinado", () => {
    const state: GlobalAccessibilityState = {
      fontScaleMultiplier: 1.5,
      highContrast: false,
      reduceMotion: false,
    };
    const style = { fontSize: 16, lineHeight: 20 };

    const result = adjustTextStyle(style, state) as any;

    // Com fontScale do sistema em 1, o multiplicador efetivo e o teto (1.3).
    expect(result).toEqual([style, { fontSize: 21, lineHeight: 26 }]);
  });

  it("aplica o fontSize padrao quando applyDefaultFontSize e true e nao ha fontSize declarado", () => {
    const state: GlobalAccessibilityState = {
      fontScaleMultiplier: 2,
      highContrast: false,
      reduceMotion: false,
    };

    const result = adjustTextStyle(undefined, state, {
      applyDefaultFontSize: true,
    }) as any;

    // 14 * COMBINED_FONT_SCALE_CAP (1.3), arredondado.
    expect(result).toEqual({ fontSize: 18 });
  });
});

describe("getEffectiveFontScaleMultiplier", () => {
  it("nao reduz o texto abaixo da escala escolhida no sistema", () => {
    // O SO ja escala 1.5x; somado ao teto, o app nao pode ampliar mais nada,
    // mas tambem nunca encolhe (piso 1).
    expect(getEffectiveFontScaleMultiplier(1.5, 1.5)).toBe(1);
  });

  it("respeita o multiplicador in-app quando o total cabe no teto", () => {
    expect(getEffectiveFontScaleMultiplier(1.15, 1)).toBe(1.15);
  });

  it("limita o produto in-app x sistema ao teto combinado", () => {
    const os = 1.2;

    expect(getEffectiveFontScaleMultiplier(2, os) * os).toBeCloseTo(
      COMBINED_FONT_SCALE_CAP
    );
  });
});
