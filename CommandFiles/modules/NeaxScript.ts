import * as nodeUtil from "util";

export namespace NeaxScript {
  export interface NSXTra {
    nsxu: typeof NXSUtil;
    nsxTarget: string;
    nsxuCreated: ReturnType<typeof NXSUtil.createFlagsAndArgs>;
    isAllowed(author: string, newTarget: string): boolean;
    isAllowed(): boolean;
    riseIsAllowed(author: string, newTarget: string): boolean;
    riseIsAllowed(): boolean;
    isTargetAdmin: boolean;
    nsxAuthor: string;
    selfNSX: Parser;
  }
  export interface Command {
    (ctx: CommandContext & NSXTra): AsyncGenerator<string, number, string>;
  }

  export interface Modifier {
    (ctx: CommandContext & NSXTra): Promise<void>;
  }

  export const Commands: Record<string, Command> = {
    async *uget({
      usersDB,
      nsxuCreated,
      nsxu,
      nsxTarget,
      isAllowed,
      nsxAuthor,
    }) {
      let keys = [...nsxuCreated.args];
      if (keys.length < 1) {
        yield "A nested keys (shallowest to deepest, separated by spaces.) is required.";
        return 4;
      }
      if (!isAllowed(nsxAuthor, nsxTarget)) {
        yield nsxu.notAllowed();
        return 2;
      }
      const data = await usersDB.getItem(nsxTarget);
      const item =
        keys[0] === "all" ? data : nsxu.getNestedProperty(data, ...keys);
      let res = `Property => ${keys.join(".")}\n\n`;
      if (nsxuCreated.hasFlag("json")) {
        yield res + nsxu.json(item);
      } else {
        yield res +
          nsxu.inspect(
            item,
            parseInt(nsxuCreated.flagValues.get("depth")) ?? undefined
          );
      }
      return 0;
    },
    async *tget({
      threadsDB,
      nsxuCreated,
      nsxu,
      nsxTarget,
      isAllowed,
      nsxAuthor,
    }) {
      let keys = [...nsxuCreated.args];
      if (keys.length < 1) {
        yield "A nested keys (shallowest to deepest, separated by spaces.) is required.";
        return 4;
      }
      if (!isAllowed(nsxAuthor, nsxTarget)) {
        yield nsxu.notAllowed();
        return 2;
      }
      const data = await threadsDB.getItem(nsxTarget);
      const item =
        keys[0] === "all" ? data : nsxu.getNestedProperty(data, ...keys);
      let res = `Property => ${keys.join(".")}\n\n`;
      if (nsxuCreated.hasFlag("json")) {
        yield res + nsxu.json(item);
      } else {
        yield res +
          nsxu.inspect(
            item,
            parseInt(nsxuCreated.flagValues.get("depth")) ?? undefined
          );
      }
      return 0;
    },
  };

  export const Modifiers: Record<string, Modifier> = {
    async rise(ctx) {
      const { input, nsxTarget } = ctx;
      if (input.isAdmin) {
        ctx.isAllowed = ctx.riseIsAllowed;
      }
    },
  };

  export type ParserCallback = (data: string) => void | Promise<void>;

  export class Parser {
    public context: CommandContext;

    constructor(context: CommandContext) {
      this.context = context;
    }

    async run(
      command: ValidCommand,
      callback: ParserCallback
    ): Promise<number> {
      const { input } = this.context;
      let mod = null;
      let [commandName, ...etc] = command.split("::");
      let [target, ...commandArgs] = etc;
      if (target === "self") {
        target = input.senderID;
      }
      const commandNameSplit = commandName.split(" ");
      if (commandNameSplit.length > 2) {
        mod = commandNameSplit[0];
        commandName = commandNameSplit[1];
      }

      if (!(commandName in NeaxScript.Commands)) {
        callback(`❌ CommandNotFound: ${commandName}`);
        return 127;
      }

      const commandFunc: NeaxScript.Command | undefined =
        NeaxScript.Commands[commandName as keyof typeof NeaxScript.Commands];

      let nsxuCreated = NXSUtil.createFlagsAndArgs(...commandArgs);
      const nsxTarget = target;

      const commandContext: CommandContext & NSXTra = {
        selfNSX: this,
        ...this.context,
        nsxuCreated,
        nsxTarget,
        nsxu: NXSUtil,
        isAllowed(...args: [string?, string?]) {
          if (args.length === 0) {
            return input.senderID === nsxTarget;
          }
          return args[0] === args[1];
        },
        riseIsAllowed(...args: [string?, string?]) {
          if (args.length === 0) {
            return input.isAdmin || input.senderID === nsxTarget;
          }
          return input.isAdmin || args[0] === args[1];
        },
        isTargetAdmin: input._isAdmin(target),
        nsxAuthor: input.senderID,
      };

      try {
        if (mod) {
          const modFunc: NeaxScript.Modifier | undefined =
            NeaxScript.Modifiers[mod as keyof typeof NeaxScript.Modifiers];
          await modFunc(commandContext);
        }
        await this.executeCommand(commandFunc, commandContext, callback);

        return 0;
      } catch (error) {
        callback(NXSUtil.err(error));
        console.error(error);
        return 3;
      }
    }

    private async executeCommand(
      commandFunc: Command,
      context: CommandContext & NSXTra,
      callback: ParserCallback
    ): Promise<string> {
      let result = "";
      for await (const output of commandFunc(context)) {
        result += output;
        try {
          callback(output);
        } catch (error) {
          console.error(error);
        }
      }
      return result;
    }
  }

  export type ValidCommand = `${
    | `${keyof typeof Modifiers} ${keyof typeof Commands}`
    | keyof typeof Commands}::${"self" | string | number} ${any}`;

  export const NXSUtil = {
    json(value: any, space = 2) {
      return JSON.stringify(value, null, space);
    },
    inspect(value: any, depth = 2) {
      return nodeUtil.inspect(value, { depth });
    },
    err(data: Error | string | Record<string, any>) {
      if (data instanceof Error) {
        return `❌ NXS Error:\n\n${data.stack}`;
      }
      if (typeof data === "string") {
        return `❌ NXS Error: ${data}`;
      }
      return `❌ NXS Error:\n\n${NXSUtil.inspect(data)}`;
    },
    notAllowed() {
      return `🔒 Rise the permission first.`;
    },
    createFlagsAndArgs(...strs: string[]) {
      const all = NXSUtil.flattenArgsAsArray(...strs);
      const flags = all.filter((i) => i.startsWith("--"));
      const args = all.filter((i) => !flags.includes(i));

      const flagValues = flags.reduce<Map<string, string | undefined>>(
        (acc, flag, index) => {
          const flagName = flag.replace(/^--/, "");
          const nextValue =
            all[index + 1] && !all[index + 1].startsWith("--")
              ? all[index + 1]
              : true;
          acc.set(flagName, nextValue ? String(nextValue) : undefined);
          return acc;
        },
        new Map<string, string | undefined>()
      );

      return {
        args,
        flags,
        flagValues,
        hasFlag(i: string) {
          return flagValues.has(i);
        },
      };
    },
    flattenArgs(...args: string[]) {
      return args.join(" ").replace(/\s+/g, " ").trim();
    },
    flattenArgsAsArray(...args: string[]) {
      return NXSUtil.flattenArgs(...args)
        .split(" ")
        .filter(Boolean);
    },
    getNestedProperty(
      obj: Record<string, unknown>,
      ...keys: string[]
    ): unknown | null {
      const flatKeys = NXSUtil.flattenArgsAsArray(...keys);

      return flatKeys.reduce<unknown>((acc, key) => {
        if (acc && typeof acc === "object" && key in acc) {
          return acc[key];
        }
        return null;
      }, obj);
    },
  };
}
