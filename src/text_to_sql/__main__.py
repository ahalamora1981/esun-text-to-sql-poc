import sys

from text_to_sql.main import main

if __name__ == "__main__":
    debug = "--debug" in sys.argv
    main(debug=debug)
