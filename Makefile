.PHONY: dev
dev:
	docker run -it --rm -v $$PWD:/app -p 5000:5000 ruphin/webdev npm run dev

.PHONY: run
run:
	docker run -it --rm -v $$PWD:/app ruphin/deno ./lib/BigNum.ts


.PHONY: shell
shell:
	docker run -it --rm -v $$PWD:/app ruphin/webdev bash

.PHONY: test
test:
	docker run -it --rm -v $$PWD:/app ruphin/deno ./test/BigNum.ts

.PHONY: build
build:
	docker run -it --rm -v $$PWD:/app ruphin/webdev npm run build

.PHONY: publish
publish:
	docker run -v $$PWD:/app \
						 -v $$HOME/.gitconfig:/home/app/.gitconfig \
						 -v $$HOME/.npmrc:/home/app/.npmrc \
						 -v $$HOME/.ssh:/home/app/.ssh \
						 -it --rm ruphin/webdev npm run release
