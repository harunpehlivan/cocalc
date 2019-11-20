/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//##############################################################################
//
//    CoCalc: Collaborative Calculation in the Cloud
//
//    Copyright (C) 2016, Sagemath Inc.
//
//    This program is free software: you can redistribute it and/or modify
//    it under the terms of the GNU General Public License as published by
//    the Free Software Foundation, either version 3 of the License, or
//    (at your option) any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with this program.  If not, see <http://www.gnu.org/licenses/>.
//
//##############################################################################

import misc from "smc-util/misc";

import * as immutable from "immutable";

import {
  React,
  rtypes,
  rclass,
  redux,
  TypedMap,
  Rendered
} from "../../app-framework";

import { Button } from "react-bootstrap";

import { Icon, Loading } from "../../r_misc";
import { WindowedList } from "../../r_misc/windowed-list";

import { LogSearch } from "./search";
import { LogEntry } from "./log-entry";
import { ProjectLogMap, EventRecord } from "./types";
import { ProjectActions } from "smc-webapp/project_store";
import { UserMap } from "smc-webapp/todo-types";

interface ReactProps {
  project_id: string;
  name: string;
  search?: string;
  actions: ProjectActions;
}

interface ReduxProps {
  project_log?: ProjectLogMap;
  project_log_all?: ProjectLogMap;
  search?: string;

  user_map?: UserMap;
  get_name: (user_id: string) => string;
}

interface State {
  cursor_index: number;
}

export const ProjectLog = rclass<ReactProps>(
  class ProjectLog extends React.Component<ReactProps & ReduxProps, State> {
    static reduxProps = ({ name }) => {
      return {
        [name]: {
          project_log: rtypes.immutable,
          project_log_all: rtypes.immutable,
          search: rtypes.string
        },
        users: {
          user_map: rtypes.immutable,
          get_name: rtypes.func
        }
      };
    };

    static defaultProps = { search: "" }; // search that user has requested

    private windowed_list_ref: React.RefObject<any>;
    private _log: immutable.List<TypedMap<EventRecord>>;
    private _search_cache: { [key: string]: string };
    private _loading_table: boolean;
    private _next_cursor_pos: number;

    constructor(props) {
      super(props);
      this.windowed_list_ref = React.createRef();
      this.state = { cursor_index: 0 };
    }

    shouldComponentUpdate(nextProps, nextState) {
      if (this.state.cursor_index !== nextState.cursor_index) {
        return true;
      }
      if (this.props.search !== nextProps.search) {
        return true;
      }
      if (
        (this.props.project_log == null || nextProps.project_log == null) &&
        (this.props.project_log_all == null ||
          nextProps.project_log_all == null)
      ) {
        return true;
      }
      if (this.props.user_map == null || nextProps.user_map == null) {
        return true;
      }
      if (!nextProps.user_map.equals(this.props.user_map)) {
        return true;
      }
      if (nextProps.project_log != null) {
        return !nextProps.project_log.equals(this.props.project_log);
      }
      if (nextProps.project_log_all != null) {
        return !nextProps.project_log_all.equals(this.props.project_log_all);
      }
      return false;
    }

    componentWillReceiveProps(next, _next_state) {
      if (
        next.user_map == null ||
        (next.project_log == null && next.project_log_all == null)
      ) {
        return;
      }
      if (
        !immutable.is(this.props.project_log, next.project_log) ||
        !immutable.is(this.props.project_log_all, next.project_log_all) ||
        this.props.search !== next.search
      ) {
        delete this._log;
      }
    }

    get_log(): immutable.List<TypedMap<EventRecord>> {
      if (this._log != null) {
        return this._log;
      }
      let logs =
        this.props.project_log_all != null
          ? this.props.project_log_all
          : this.props.project_log;
      if (logs == null) {
        this._log = immutable.List();
        return this._log;
      }

      let logs_seq = logs.valueSeq().toList();
      if (this.props.search) {
        if (this._search_cache == null) {
          this._search_cache = {};
        }
        const terms = misc.search_split(this.props.search.toLowerCase());
        const names = {};
        const match = (z: TypedMap<EventRecord>): boolean => {
          let s: string = this._search_cache[z.get("id")];
          if (s == null) {
            let name1;
            s =
              names[(name1 = z.get("account_id"))] != null
                ? names[name1]
                : (names[name1] = this.props.get_name(z.get("account_id")));
            const event = z.get("event");
            if (event != null) {
              event.forEach((val, k) => {
                if (k !== "event" && k !== "filename") {
                  s += " " + k;
                }
                if (k === "type") {
                  return;
                }
                s += " " + val;
              });
            }
            s = s.toLowerCase();
            this._search_cache[z.get("id")] = s;
          }
          return misc.search_match(s, terms);
        };
        logs_seq = logs_seq.filter(match);
      }
      logs_seq = logs_seq.sort(
        (a, b) => b.get("time").valueOf() - a.get("time").valueOf()
      );
      this._log = logs_seq;
      return this._log;
    }

    move_cursor_to(cursor_index) {
      if (cursor_index < 0 || cursor_index >= this.get_log().size) {
        return;
      }
      this.setState({ cursor_index });
      this.windowed_list_ref.current?.scrollToRow(cursor_index);
    }

    increment_cursor() {
      this.move_cursor_to(this.state.cursor_index + 1);
    }

    decrement_cursor() {
      this.move_cursor_to(this.state.cursor_index - 1);
    }

    reset_cursor() {
      this.move_cursor_to(0);
    }

    load_all() {
      this._next_cursor_pos = this.get_log().size - 1;
      delete this._loading_table;
      this.props.actions.project_log_load_all();
    }

    render_load_all_button() {
      if (this.props.project_log_all != null) {
        return;
      }
      return (
        <Button
          bsStyle={"info"}
          onClick={() => this.load_all()}
          disabled={this.props.project_log_all != null}
        >
          Load older log entries
        </Button>
      );
    }

    row_renderer(index): Rendered {
      const log = this.get_log();
      if (index === log.size) {
        return this.render_load_all_button();
      }
      const x = log.get(index);
      if (x == null) {
        return;
      }
      return (
        <LogEntry
          cursor={this.state.cursor_index === index}
          time={x.get("time")}
          event={x.get("event").toJS()}
          account_id={x.get("account_id")}
          user_map={this.props.user_map}
          backgroundStyle={
            index % 2 === 0 ? { backgroundColor: "#eee" } : undefined
          }
          project_id={this.props.project_id}
        />
      );
    }

    row_key(index: number): string {
      return `${index}`;
    }

    render_log_entries(): JSX.Element {
      const next_cursor_pos = this._next_cursor_pos;
      if (this._next_cursor_pos) {
        delete this._next_cursor_pos;
      }
      return (
        <WindowedList
          ref={this.windowed_list_ref}
          overscan_row_count={20}
          estimated_row_size={22}
          row_count={this.get_log().size + 1}
          row_renderer={x => this.row_renderer(x.index)}
          row_key={this.row_key}
          scroll_to_index={next_cursor_pos}
          cache_id={"project_log" + this.props.project_id}
        />
      );
    }

    render_log_panel(): JSX.Element {
      return (
        <div
          className="smc-vfill"
          style={{ border: "1px solid #ccc", borderRadius: "3px" }}
        >
          {this.render_log_entries()}
        </div>
      );
    }

    render_body(): JSX.Element {
      if (!this.props.project_log && !this.props.project_log_all) {
        if (!this._loading_table) {
          this._loading_table = true;
          // The project log not yet loaded, so kick off the load.
          // This is safe to call multiple times and is done so that the
          // changefeed for the project log is only setup if the user actually
          // looks at the project log at least once.
          redux
            .getProjectStore(this.props.project_id)
            .init_table("project_log");
        }
        return <Loading theme={"medium"} />;
      }
      this._loading_table = false;
      return this.render_log_panel();
    }

    render_search(): JSX.Element {
      return (
        <LogSearch
          actions={this.props.actions}
          search={this.props.search}
          selected={this.get_log().get(this.state.cursor_index)}
          increment_cursor={() => this.increment_cursor()}
          decrement_cursor={() => this.decrement_cursor()}
          reset_cursor={() => this.reset_cursor()}
        />
      );
    }

    render(): JSX.Element {
      return (
        <div style={{ padding: "15px" }} className={"smc-vfill"}>
          <h1 style={{ marginTop: "0px" }}>
            <Icon name="history" /> Project activity log
          </h1>
          {this.render_search()}
          {this.render_body()}
        </div>
      );
    }
  }
);
