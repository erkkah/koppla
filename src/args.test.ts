import { parseArguments } from "./args";

describe("args parser", () => {
    it("parses empty args", () => {
        const [parsed, files] = parseArguments([], {});
        expect(parsed).toMatchObject({});
        expect(files).toHaveLength(0);
    });

    it("parses just files", () => {
        const [parsed, files] = parseArguments(["file.wav", "cool.gif"], {});
        expect(parsed).toMatchObject({});
        expect(files).toMatchObject(["file.wav", "cool.gif"]);
    });

    it("parses just options", () => {
        const [parsed, files] = parseArguments(
            ["-horse=shoe", "-count=42", "-yep"],
            {
                horse: "head",
                count: 12,
                yep: false,
            }
        );
        expect(parsed).toMatchObject({
            horse: "shoe",
            count: 42,
            yep: true,
        });
        expect(files).toMatchObject([]);
    });

    it("keeps default values", () => {
        const [parsed, files] = parseArguments(["-horse=shoe"], {
            horse: "head",
            count: 12,
            yep: false,
        });
        expect(parsed).toMatchObject({
            horse: "shoe",
            count: 12,
            yep: false,
        });
        expect(files).toMatchObject([]);
    });

    it("throws on bad template", () => {
        expect(() => {
            parseArguments(["-horse=shoe"], {
                horse: {
                    head: true,
                },
            });
        }).toThrow(/.*horse.*/);
    });

    it("throws on bad option", () => {
        expect(() => {
            parseArguments(["-horse=shoe"], {
                count: 42,
            });
        }).toThrow(/.*horse.*/);
    });

    it("handles bad number options", () => {
        const [parsed] = parseArguments(["-count=five"], {
            count: 12,
        });
        expect(parsed.count).toBe(NaN);
    });

    it("handles bad boolean options", () => {
        const [parsed] = parseArguments(["-yep=maybe"], {
            yep: false,
        });
        expect(parsed.yep).toBe(true);
    });

    it("handles boolean option argument", () => {
        const [parsed] = parseArguments(
            ["-one=false", "--two=No", "--three=0", "-four=TRUE"],
            {
                one: true,
                two: true,
                three: true,
                four: false,
            }
        );
        expect(parsed.one).toBe(false);
        expect(parsed.two).toBe(false);
        expect(parsed.three).toBe(false);
        expect(parsed.four).toBe(true);
    });

    test("example code", () => {
        process.argv = [];

        const template = {
            help: false,
            count: 42,
            color: "black",
        };

        const [parsed, files] = parseArguments(process.argv.slice(2), template);

        parsed;
        files;
    });
});
