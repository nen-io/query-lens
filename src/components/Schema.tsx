import { ChevronRight, Database, KeyRound, Table2 } from "lucide-react";
import type { SchemaTable, TableName } from "../domain/dataset";
export function Schema({
  schema,
  onExplore,
}: {
  schema: SchemaTable[];
  onExplore: (name: TableName) => void;
}) {
  return (
    <aside className="schema-panel panel" aria-label="Dataset schema">
      <div className="section-label">
        SCHEMA EXPLORER
        <Database size={13} />
      </div>
      <div className="database-name">
        <span className="database-icon">
          <Database size={18} />
        </span>
        <div>
          <strong>Everyday Goods</strong>
          <span>synthetic_store.db</span>
        </div>
      </div>
      <p className="schema-intro">Small objects. Useful questions.</p>
      <div className="table-list">
        {schema.length ? (
          schema.map((table) => (
            <details
              key={table.name}
              open={table.name === "orders" || table.name === "order_items"}
            >
              <summary>
                <ChevronRight size={12} />
                <Table2 size={13} />
                <span>{table.name}</span>
                <small>{table.count}</small>
              </summary>
              <ul>
                {table.columns.map((column) => (
                  <li key={column.name}>
                    <span>
                      {column.primary ? (
                        <KeyRound size={10} />
                      ) : (
                        <i className="column-dot" />
                      )}
                      {column.name}
                      {column.nullable ? (
                        <small className="nullable" title="Nullable column">
                          ?
                        </small>
                      ) : null}
                    </span>
                    <small>{column.type}</small>
                  </li>
                ))}
              </ul>
              <button
                className="explore-table"
                onClick={() => onExplore(table.name)}
              >
                Preview table <ChevronRight size={11} />
              </button>
            </details>
          ))
        ) : (
          <p className="schema-loading">Loading the local database…</p>
        )}
      </div>
      <div className="dataset-note">
        <span className="tiny-orbit" />
        <h3>Made for exploration</h3>
        <p>
          72 synthetic orders, Jan–Mar 2026. Money is integer USD cents. No
          customer data or external service.
        </p>
      </div>
    </aside>
  );
}
